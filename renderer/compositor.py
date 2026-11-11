"""Shared Pillow compositor for deterministic FFmpeg and Manim exports."""
from __future__ import annotations

import math
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from .model import Journey, RenderInput

WIDTH, HEIGHT = 1280, 720
BACKGROUND = "#071613"


def font(size: int, bold: bool = False):
    win = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
    candidates = [win / ("segoeuib.ttf" if bold else "segoeui.ttf"),
                  Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default(size=size)


def rgb(value: str):
    return tuple(int(value[i:i+2], 16) for i in (1, 3, 5))


def mix(a: str, b: str, amount: float):
    amount = max(0, min(1, amount))
    return tuple(round(x + (y-x) * amount) for x, y in zip(rgb(a), rgb(b)))


def partial(points, proportion):
    """Reveal a polyline by geometric length, preserving bends."""
    if proportion <= 0:
        return []
    if proportion >= 1:
        return points
    lengths = [math.dist(a, b) for a, b in zip(points, points[1:])]
    remaining = sum(lengths) * proportion
    revealed = [points[0]]
    for a, b, length in zip(points, points[1:], lengths):
        if remaining >= length:
            revealed.append(b)
            remaining -= length
        else:
            fraction = remaining / length if length else 0
            revealed.append((a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction))
            break
    return revealed


class Compositor:
    def __init__(self, data: RenderInput, graph, journeys: list[Journey], destination):
        self.data, self.graph, self.journeys, self.destination = data, graph, journeys, destination
        self.fonts = {size: font(size) for size in (11, 12, 13, 14, 16, 18, 22, 28, 36)}
        self.bold = {size: font(size, True) for size in (11, 12, 13, 14, 16, 18, 22, 28, 36)}
        coords = [(n["x"], n["y"]) for _, n in graph.nodes(data=True)]
        self.minx, self.maxx = min(x for x, _ in coords), max(x for x, _ in coords)
        self.miny, self.maxy = min(y for _, y in coords), max(y for _, y in coords)
        self.cos_lat = math.cos(math.radians((self.miny+self.maxy)/2))
        self.scale = min(850 / max(1e-9, (self.maxx-self.minx) * self.cos_lat), 440 / max(1e-9, self.maxy-self.miny))
        self.center = ((self.minx+self.maxx)/2, (self.miny+self.maxy)/2)
        self.node_points = {n: self.project((v["x"], v["y"])) for n, v in graph.nodes(data=True)}
        self.edges = {}
        for u, v, k, edge in graph.edges(keys=True, data=True):
            geom = edge.get("geometry")
            coords = list(geom.coords) if geom is not None else [(graph.nodes[u]["x"], graph.nodes[u]["y"]), (graph.nodes[v]["x"], graph.nodes[v]["y"])]
            # OSM edge geometry can be saved in the opposite orientation.
            if math.dist(coords[0], (graph.nodes[u]["x"], graph.nodes[u]["y"])) > math.dist(coords[-1], (graph.nodes[u]["x"], graph.nodes[u]["y"])):
                coords.reverse()
            self.edges[(u, v, k)] = [self.project(p) for p in coords]
        self.routes = []
        for journey in journeys:
            points = []
            for edge in journey.edges:
                segment = self.edges[edge]
                points.extend(segment if not points else segment[1:])
            if not points:
                points = [self.node_points[journey.origin]] * 2
            self.routes.append(points)
        earliest_by_geometry = {}
        for (u, v, k), points in self.edges.items():
            candidates = [(j.distances[u] / max(j.seconds, .01), i) for i, j in enumerate(journeys) if u in j.distances]
            if not candidates:
                continue
            start, owner = min(candidates)
            edge_time = graph[u][v][k]["travel_time"] / max(journeys[owner].seconds, .01)
            end = start + edge_time
            # Reciprocal roads share geometry, but their entry nodes differ.
            # Select the earliest directed activation before deduplicating, and
            # retain distinct geometries for parallel streets between two nodes.
            geometry = tuple(points)
            signature = min(geometry, geometry[::-1])
            rank = (start, end, owner)
            previous = earliest_by_geometry.get(signature)
            if previous is None or rank < previous[0]:
                earliest_by_geometry[signature] = (rank, (points, start, end, journeys[owner].color))
        self.flood = [entry[1] for entry in earliest_by_geometry.values()]
        self.static = self.make_static()

    def project(self, xy):
        return (485 + (xy[0] - self.center[0]) * self.cos_lat * self.scale,
                407 - (xy[1] - self.center[1]) * self.scale)

    def make_static(self):
        canvas = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
        draw = ImageDraw.Draw(canvas)
        draw.text((40, 27), "KULANGOR / MEET", fill="#9AC8B7", font=self.bold[13])
        draw.text((40, 54), self.data.title, fill="#F0F5ED", font=self.bold[36])
        description = "Twenty starting points. A road network. One place to meet." if len(self.journeys) == 20 else "Different starting points. A road network. One place to meet."
        draw.text((42, 108), description, fill="#8DA69C", font=self.fonts[16])
        badge = "SYNTHETIC DEMO" if self.data.source == "synthetic" else "INDEPENDENT OSM STUDY"
        draw.rounded_rectangle((1020, 35, 1238, 67), radius=16, fill="#13372C", outline="#285044")
        draw.text((1037, 43), badge, fill="#AFE3C9", font=self.bold[12])
        draw.line((40, 147, 1240, 147), fill="#224035")
        draw.line((948, 171, 948, 642), fill="#224035")
        for pts in self.edges.values():
            draw.line(pts, fill="#1A332B", width=1)
        draw.text((981, 173), f"{len(self.journeys):02d} journeys", font=self.bold[22], fill="#F0F5ED")
        draw.text((982, 205), "NAME", font=self.bold[11], fill="#79998B")
        draw.text((1194, 205), "KM", font=self.bold[11], fill="#79998B")
        for i, journey in enumerate(self.journeys):
            y = 233 + i * 20
            draw.ellipse((982, y+4, 988, y+10), fill=journey.color)
            draw.text((1000, y), journey.name[:20], font=self.fonts[13], fill="#C0D2C6")
        draw.line((40, 660, 1240, 660), fill="#224035")
        note = "Invented roads & distances · visual demonstration only" if self.data.source == "synthetic" else "© OpenStreetMap contributors · independently computed road paths"
        draw.text((40, 680), note, font=self.fonts[12], fill="#819C8E")
        draw.text((1015, 680), "60 FPS  /  ROAD CONVERGENCE", font=self.fonts[11], fill="#819C8E")
        return canvas

    def frame(self, seconds: float, duration: float = 10):
        fraction = max(0, min(1, seconds/duration))
        flood_progress = max(0, min(1, (fraction-.07)/.57))
        route_progress = max(0, min(1, (fraction-.63)/.13))
        flood_fade = max(.10, 1 - max(0, (fraction-.68)/.15))
        canvas = self.static.copy()
        draw = ImageDraw.Draw(canvas)
        layer = Image.new("RGB", canvas.size, "black")
        glow = ImageDraw.Draw(layer)
        active = []
        for points, start, end, color in self.flood:
            if start >= flood_progress or start > 1:
                continue
            progress = (flood_progress-start)/max(.001, end-start)
            segment = partial(points, progress)
            if len(segment) >= 2:
                active.append((segment, color, progress))
                glow.line(segment, fill=mix("#000000", color, .7*flood_fade), width=3)
        if fraction < .82:
            from PIL import ImageChops
            canvas = ImageChops.add(canvas, layer.filter(ImageFilter.GaussianBlur(4)))
            draw = ImageDraw.Draw(canvas)
        for segment, color, progress in active:
            draw.line(segment, fill=mix("#14291F", color, .86*flood_fade), width=1)
            if progress < 1 and flood_fade > .8:
                x, y = segment[-1]
                draw.ellipse((x-1.2,y-1.2,x+1.2,y+1.2), fill=mix(color,"#FFFFFF",.65))
        if route_progress > 0:
            route_layer = Image.new("RGB", canvas.size, "black")
            rdraw = ImageDraw.Draw(route_layer)
            segments = []
            for points, journey in zip(self.routes, self.journeys):
                segment = partial(points, route_progress)
                segments.append((segment, journey.color))
                rdraw.line(segment, fill=mix("#000000", journey.color, .8), width=5)
            from PIL import ImageChops
            canvas = ImageChops.add(canvas, route_layer.filter(ImageFilter.GaussianBlur(4)))
            draw = ImageDraw.Draw(canvas)
            for segment, color in segments:
                draw.line(segment, fill=color, width=2)
        # Origins stay visible throughout the road-front animation.
        for i, journey in enumerate(self.journeys):
            x, y = self.node_points[journey.origin]
            pulse = .5 + .5*math.sin(seconds*2 + i*.4)
            r = 5 + pulse if fraction < .72 else 5
            draw.ellipse((x-r-3,y-r-3,x+r+3,y+r+3), fill="#0A1A15", outline=mix("#163527", journey.color, .4))
            draw.ellipse((x-r,y-r,x+r,y+r), fill=journey.color)
            initials = "".join(p[0] for p in journey.name.split())[:2].upper()
            draw.text((x+10,y-8), initials, font=self.bold[11], fill=mix("#A5B7AA",journey.color,.7), stroke_width=2,stroke_fill=BACKGROUND)
            if fraction > .70:
                km = f"{journey.meters/1000:.1f}"
                draw.text((1218-draw.textlength(km,font=self.fonts[13]),233+i*20),km,font=self.fonts[13],fill=journey.color)
        x, y = self.node_points[self.destination]
        color = "#FCBA6B"
        if fraction > .63:
            r = 17 + 5 * math.sin(seconds*2)**2
            draw.ellipse((x-r,y-r,x+r,y+r), outline="#6F5635", width=1)
            draw.ellipse((x-10,y-10,x+10,y+10),fill=BACKGROUND,outline=color,width=2)
            draw.ellipse((x-4,y-4,x+4,y+4),fill=color)
            label = self.data.destination.name[:28]
            label_width = draw.textlength(label,font=self.bold[14])+30
            draw.rounded_rectangle((x-label_width/2,y+26,x+label_width/2,y+58),radius=8,fill="#17382A",outline="#4A6750")
            draw.text((x-label_width/2+15,y+33),label,font=self.bold[14],fill="#F1D5A8")
        else:
            draw.ellipse((x-4,y-4,x+4,y+4), fill="#596C57")
        status = "FINDING THE CONNECTION" if fraction < .64 else "ALL ROADS LEAD TOGETHER"
        draw.rounded_rectangle((40, 167, 285, 195), radius=14, fill="#102A20")
        draw.ellipse((51, 177, 57, 183), fill="#67D8A5" if fraction < .64 else color)
        draw.text((67, 174), status, font=self.bold[11], fill="#B9D8C5")
        # Timeline shows the two intentional visual phases.
        draw.rounded_rectangle((40, 642, 915, 645),radius=1,fill="#244135")
        draw.rounded_rectangle((40,642,40+875*fraction,645),radius=1,fill="#8BBC9F")
        return canvas
