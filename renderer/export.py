"""60 FPS H.264 MP4 writers. Manim and the lightweight writer share frames."""
from pathlib import Path


def export_pillow(compositor, output: Path, duration: float, fps: int = 60):
    import imageio_ffmpeg

    output.parent.mkdir(parents=True, exist_ok=True)
    writer = imageio_ffmpeg.write_frames(str(output), (1280, 720), fps=fps, codec="libx264", quality=8,
                                        pix_fmt_in="rgb24", pix_fmt_out="yuv420p", macro_block_size=16,
                                        output_params=["-movflags", "+faststart", "-preset", "fast"])
    writer.send(None)
    total = round(duration*fps)
    try:
        for frame in range(total):
            writer.send(compositor.frame(frame/fps, duration).tobytes())
            if frame % fps == 0:
                print(f"Rendering {frame//fps:02d}s / {duration:g}s", flush=True)
    finally:
        writer.close()


def export_manim(compositor, output: Path, duration: float, fps: int = 60):
    """Manim's Cairo scene renders the same road fronts and geographic geometry."""
    try:
        import numpy as np
        from manim import ImageMobject, Scene, ValueTracker, linear, tempconfig
    except ImportError as exc:
        raise RuntimeError("Install renderer/requirements.txt to use --engine manim, or use --engine pillow.") from exc
    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    print(f"Rendering Manim scene: {duration:g}s at {fps} FPS...", flush=True)

    class RoadConvergence(Scene):
        def construct(self):
            clock = ValueTracker(0)
            frame = ImageMobject(np.asarray(compositor.frame(0, duration)))
            frame.height = self.camera.frame_height
            self.add(frame)

            def update(image):
                # Geometry is fixed. Updating pixels avoids interpolating a full
                # image mobject (and allocating several float arrays) per frame.
                image.pixel_array = np.asarray(compositor.frame(clock.get_value(), duration).convert("RGBA")).copy()

            frame.add_updater(update)
            self.play(clock.animate.set_value(duration), run_time=duration, rate_func=linear)
            frame.clear_updaters()

    with tempconfig({"pixel_width":1280,"pixel_height":720,"frame_rate":fps,
                     "frame_width":1280/90,"frame_height":8,"background_color":"#071613",
                     "format":"mp4","write_to_movie":True,"disable_caching":True,
                     "progress_bar":"none","verbosity":"WARNING",
                     "output_file":output.stem,"media_dir":str(Path(".data/manim").resolve()) } ):
        scene = RoadConvergence()
        scene.render()
        rendered = Path(scene.renderer.file_writer.movie_file_path)
        import shutil
        shutil.copy2(rendered, output)
