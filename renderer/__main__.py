"""python -m renderer --demo | --input independent-locations.json"""
import argparse
import json
from pathlib import Path

from .compositor import Compositor
from .demo import synthetic_city
from .export import export_manim, export_pillow
from .model import RenderInput, analyze_graph, get_osm_graph


def main():
    parser = argparse.ArgumentParser(description="Independent road-front animation; Google-derived inputs are not accepted.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--demo", action="store_true", help="Render deterministic invented city roads without network access.")
    mode.add_argument("--input", type=Path, help="JSON with independent participant and destination coordinates.")
    parser.add_argument("--engine", choices=["pillow", "manim"], default="pillow")
    parser.add_argument("--output", type=Path, default=Path("renders/meeting.mp4"))
    parser.add_argument("--poster", type=Path, help="Optional final-frame PNG.")
    parser.add_argument("--duration", type=float, default=10)
    parser.add_argument("--fps", type=int, default=60)
    parser.add_argument("--graphml", type=Path, help="Read an existing OSM graph cache or save a downloaded one here.")
    parser.add_argument("--padding-km", type=float, default=6)
    args = parser.parse_args()
    if not 3 <= args.duration <= 120 or not 1 <= args.fps <= 120 or not 1 <= args.padding_km <= 50:
        parser.error("duration must be 3–120s, fps 1–120, padding-km 1–50.")
    try:
        if args.demo:
            data, graph, origins, destination = synthetic_city()
        else:
            data = RenderInput.read(args.input)
            if data.source == "synthetic":
                raise ValueError("Use --demo for synthetic data; --input requires manual or openstreetmap coordinates.")
            print("Preparing independent OSM drive graph (first download can take several minutes)...", flush=True)
            graph, origins, destination = get_osm_graph(data, args.graphml, args.padding_km)
            print(f"Loaded {graph.number_of_nodes()} road nodes and {graph.number_of_edges()} directed edges.", flush=True)
        journeys = analyze_graph(graph, origins, destination, [p.name for p in data.participants])
        compositor = Compositor(data, graph, journeys, destination)
        (export_manim if args.engine == "manim" else export_pillow)(compositor, args.output, args.duration, args.fps)
        if args.poster:
            args.poster.parent.mkdir(parents=True, exist_ok=True)
            compositor.frame(args.duration, args.duration).save(args.poster)
        metadata = {"source":data.source,"engine":args.engine,"fps":args.fps,"width":1280,"height":720,
                    "durationSeconds":args.duration,"nodes":graph.number_of_nodes(),"edges":graph.number_of_edges(),
                    "destination":data.destination.name,"trafficAware":False,
                    "journeys":[{"name":j.name,"color":j.color,"meters":round(j.meters,2),"estimatedRoadSeconds":round(j.seconds,2)} for j in journeys]}
        args.output.with_suffix(".json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        print(f"Saved {args.output.resolve()} ({args.fps} FPS; {len(journeys)} independent road paths)")
    except (ValueError, RuntimeError, OSError) as exc:
        parser.exit(1, f"Renderer error: {exc}\n")


if __name__ == "__main__":
    main()
