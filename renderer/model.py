"""Input provenance and directed, weighted road analysis."""
from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import networkx as nx

COLORS = (
    "#31D9C6", "#F876AA", "#9CDF6B", "#AB8BFA", "#F8BB59",
    "#57B9FF", "#FF8772", "#63DAB2", "#EBC5FF", "#D5DD5B",
    "#70D8F2", "#EF8BD9", "#B5DA93", "#8FADFF", "#E9A75A",
    "#A3E5DD", "#FBB8B9", "#C2B4F5", "#67BC93", "#F4D49C",
)


def reject_google(value: Any) -> None:
    """Fail closed if any nested source/provenance string names Google."""
    if isinstance(value, dict):
        for key, item in value.items():
            if key.lower() in {"source", "provenance", "provider", "data_source"}:
                if "google" in json.dumps(item).lower():
                    raise ValueError("Google-derived data cannot be used in the independent road renderer.")
            reject_google(item)
    elif isinstance(value, list):
        for item in value:
            reject_google(item)


@dataclass(frozen=True)
class Location:
    name: str
    lat: float
    lng: float


@dataclass(frozen=True)
class RenderInput:
    source: str
    participants: tuple[Location, ...]
    destination: Location
    title: str = "A fair place to come together."

    @classmethod
    def parse(cls, payload: dict) -> "RenderInput":
        if not isinstance(payload, dict):
            raise ValueError("The input JSON must contain a location object.")
        reject_google(payload)
        source = payload.get("source")
        if source not in {"openstreetmap", "manual", "synthetic"}:
            raise ValueError("source must explicitly be openstreetmap, manual, or synthetic.")
        if payload.get("independentCoordinates") is not True:
            raise ValueError("Set independentCoordinates:true only for coordinates obtained independently of Google.")

        def place(item: dict) -> Location:
            if not isinstance(item, dict):
                raise ValueError("Each location must be an object.")
            name = item.get("name")
            lat, lng = item.get("lat"), item.get("lng")
            if not isinstance(name, str) or not name.strip() or len(name) > 80:
                raise ValueError("Each location requires a name of 1–80 characters.")
            if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in (lat, lng)):
                raise ValueError("Location coordinates must be finite numbers.")
            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                raise ValueError("Coordinates are outside latitude/longitude bounds.")
            return Location(name.strip(), float(lat), float(lng))

        members = payload.get("participants")
        if not isinstance(members, list) or not 2 <= len(members) <= 20:
            raise ValueError("Provide between 2 and 20 participants.")
        destination = payload.get("destination")
        title = payload.get("title", "A fair place to come together.")
        if not isinstance(title, str) or len(title) > 100:
            raise ValueError("title must be a string up to 100 characters.")
        return cls(source, tuple(place(p) for p in members), place(destination), title)

    @classmethod
    def read(cls, path: str | Path) -> "RenderInput":
        return cls.parse(json.loads(Path(path).read_text(encoding="utf-8")))


@dataclass
class Journey:
    name: str
    color: str
    origin: Any
    nodes: list
    edges: list[tuple[Any, Any, Any]]
    distances: dict
    seconds: float
    meters: float


def analyze_graph(graph: nx.MultiDiGraph, origins: list, destination: Any, names: list[str]) -> list[Journey]:
    """Shortest driving-time paths, preserving one-way and parallel-edge identity."""
    if not graph.is_directed() or not graph.is_multigraph():
        raise ValueError("The renderer requires a directed MultiDiGraph.")
    if len(origins) != len(names) or not 2 <= len(origins) <= len(COLORS):
        raise ValueError("Supply 2–20 origins with matching names.")
    for _, _, _, edge in graph.edges(keys=True, data=True):
        for field in ("length", "travel_time"):
            value = edge.get(field)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                raise ValueError(f"Every road edge requires nonnegative finite {field}.")
    journeys = []
    for i, (origin, name) in enumerate(zip(origins, names)):
        try:
            distances, paths = nx.single_source_dijkstra(graph, origin, weight="travel_time")
        except nx.NodeNotFound as exc:
            raise ValueError(f"No road node found for {name}.") from exc
        if destination not in paths:
            raise ValueError(f"No directed driving route from {name} to the destination. Increase graph padding or choose a reachable location.")
        nodes = paths[destination]
        edges = []
        for u, v in zip(nodes, nodes[1:]):
            # Match NetworkX's minimum travel_time across parallel directed edges.
            key = min(graph[u][v], key=lambda k: (graph[u][v][k]["travel_time"], graph[u][v][k]["length"], str(k)))
            edges.append((u, v, key))
        journeys.append(Journey(name, COLORS[i], origin, nodes, edges, distances,
                                distances[destination], sum(graph[u][v][k]["length"] for u, v, k in edges)))
    return journeys


def get_osm_graph(data: RenderInput, graphml: Path | None = None, padding_km: float = 6) -> tuple[nx.MultiDiGraph, list, Any]:
    """Download only the extent needed for these independent coordinates."""
    try:
        import osmnx as ox
    except ImportError as exc:
        raise RuntimeError("OSM rendering requires the packages in renderer/requirements.txt; the synthetic demo needs only requirements-demo.txt.") from exc
    ox.settings.cache_folder = ".data/osm-cache"
    points = [*data.participants, data.destination]
    cached = bool(graphml and graphml.exists())
    if cached:
        graph = ox.io.load_graphml(graphml)
        reject_google(graph.graph)
    else:
        latitudes, longitudes = [p.lat for p in points], [p.lng for p in points]
        mean_lat = sum(latitudes) / len(latitudes)
        lat_pad = padding_km / 111.32
        lng_pad = padding_km / (111.32 * max(0.1, math.cos(math.radians(mean_lat))))
        bbox = (min(longitudes) - lng_pad, min(latitudes) - lat_pad,
                max(longitudes) + lng_pad, max(latitudes) + lat_pad)
        graph = ox.graph.graph_from_bbox(bbox, network_type="drive", retain_all=True)
        graph = ox.routing.add_edge_speeds(graph, fallback=40)
        graph = ox.routing.add_edge_travel_times(graph)
        if graphml:
            graphml.parent.mkdir(parents=True, exist_ok=True)
            ox.io.save_graphml(graph, graphml)
    if not all("travel_time" in e for _, _, e in graph.edges(data=True)):
        graph = ox.routing.add_edge_speeds(graph, fallback=40)
        graph = ox.routing.add_edge_travel_times(graph)
    snapped = list(ox.distance.nearest_nodes(graph, X=[p.lng for p in points], Y=[p.lat for p in points]))
    for point, node in zip(points, snapped):
        road = graph.nodes[node]
        lat_delta = math.radians(road["y"] - point.lat)
        lng_delta = math.radians(road["x"] - point.lng)
        a = math.sin(lat_delta/2)**2 + math.cos(math.radians(point.lat))*math.cos(math.radians(road["y"]))*math.sin(lng_delta/2)**2
        meters = 6371000*2*math.asin(min(1, math.sqrt(a)))
        if meters > 1500:
            advice = " The cached graph may cover a different area; use a new --graphml filename." if cached else " Check coordinates or increase --padding-km."
            raise ValueError(f"{point.name} is {meters/1000:.1f} km from its nearest road node; refusing an inaccurate route.{advice}")
    return graph, snapped[:-1], snapped[-1]
