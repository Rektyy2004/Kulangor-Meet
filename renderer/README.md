# Independent road animation

This pipeline separates the artistic road animation from the web app's Google traffic calculation. It never consumes the app's Google venue, coordinate, matrix, or route exports. Supply coordinates independently obtained from OpenStreetMap, a GPS device, or your own manually surveyed data. `independentCoordinates: true` is an explicit declaration about their origin, not a conversion of Google coordinates into independent data. Nested Google `source`, `provenance`, `provider`, or `data_source` values are rejected.

## Run the included demo

From the project root with Python 3.12 or later:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r renderer/requirements-demo.txt
python -m renderer --demo --engine pillow --output public/demo-preview.mp4 --poster public/demo-poster.png
python -m unittest discover -s tests -p test_renderer.py
```

This makes a 10-second, 1280×720, 60 FPS H.264 MP4. Its invented street graph, participant names, and distance figures are clearly marked synthetic. No Overpass download or API key is needed. `public/demo-preview.json` records frame rate, dimensions, graph statistics, and independently computed journey lengths. The Pillow/FFmpeg writer is a lightweight way to run the exact same visual compositor used by the Manim scene.

## Render actual OSM roads with Manim

Install the full Python dependencies, including OSMnx 2.1.1 and Manim Community 0.22.1. Follow [Manim's platform installation guide](https://docs.manim.community/en/stable/installation.html) if Cairo/Pango or other native prerequisites are missing. Text uses system fonts and does not require LaTeX. A fresh environment is recommended.

```powershell
python -m pip install -r renderer/requirements.txt
python -m renderer --input renderer/example-input.json --engine manim --graphml .data/kl-drive.graphml --output renders/meeting.mp4 --poster renders/meeting.png
```

Replace the example's illustrative, manually chosen coordinates with 2–20 independently sourced participant locations and a destination. The supplied destination is honored; the renderer does not recalculate or substitute the live Google winner. OpenStreetMap has no equivalent to live Google traffic. Use a destination you independently selected or independently surveyed, and check the applicable provider terms for your intended export.

`--graphml` reads an existing directed OSM graph, or saves a new download there. The bounding box is derived from all input points plus a default 6 km margin. Increase `--padding-km 12` if routes detour outside that extent. The graph must contain directed drive roads. Cached graphs are checked for unreasonably distant snapping; if the cache covers another area, use a new filename. The Overpass service is shared infrastructure: allow time for large requests and respect service limits. First download requires network access; subsequent cache runs do not.

## What the animation means

Each participant gets a distinct color. Weighted Dijkstra respects one-way roads and minimizes estimated OSM driving time; each parallel-edge choice matches that weight. Road fronts reveal from each origin, then the independently computed paths glow while background roads fade. Displayed kilometers are sums of those exact directed graph edges. OSM lengths and inferred speeds are estimates, not Google distances or live traffic. Route drawing retains curved edge geometry.

Fronts are normalized to bring all origins to the destination during one visual phase. This is an artistic timeline; it does not imply everyone takes the same travel time. The on-screen map is schematic, with a geographic projection and no map tiles. Inputs far from a drivable road, disconnected origins, malformed weights, and prohibited provenance fail explicitly instead of inventing paths.

Use `--engine pillow` with real OSM inputs if you prefer the lightweight writer, or `--demo --engine manim` to verify Manim without Overpass. Both engines default to 60 FPS. Optional `--duration 15 --fps 60` changes timing. Render jobs run as a CLI/background process; do not run them inside a short web request.

The compositor uses a raster `ImageMobject` updated by a Manim `ValueTracker`; both engines therefore share exactly the same road-front, glowing-route, and legend implementation. Manim's native dependencies can be installed separately without changing routing logic.

## Verification performed

Python 3.12: all 14 focused unit tests passed, including reverse-first activation on reciprocal roads and distinct fronts on parallel streets. Both rendering engines produced H.264/yuv420p output at 1280×720 and 60 FPS. A live OSMnx/Overpass download for a small central Kuala Lumpur extent returned 469 road nodes and 773 directed edges; two independently supplied manual origins rendered successfully along the downloaded geometry. A separate 20-person Manim synthetic render also completed. These checks do not verify live Google billing, traffic responses, or Supabase credentials.

[OSMnx API reference](https://osmnx.readthedocs.io/en/stable/user-reference.html) · [OpenStreetMap attribution](https://www.openstreetmap.org/copyright) · [Google Routes policies](https://developers.google.com/maps/documentation/routes/policies)
