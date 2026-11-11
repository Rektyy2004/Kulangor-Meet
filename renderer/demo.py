"""Deterministic invented city graph: no downloads, maps, or provider data."""
import math
import random

import networkx as nx

from .model import Location, RenderInput

NAMES = ["Ahmad", "Sarah", "Jason", "Priya", "Wei Ming", "Aisyah", "Daniel", "Mei Ling", "Farhan", "Kavitha", "Adam", "Hannah", "Raj", "Siti", "Marcus", "Nurul", "Chloe", "Arjun", "Amir", "Grace"]


def synthetic_city():
    rng = random.Random(41)
    graph = nx.MultiDiGraph(crs="EPSG:4326")
    cols, rows = 39, 29
    for y in range(rows):
        for x in range(cols):
            # Organic bends, varying block sizes, and a diagonal river corridor.
            px = x + 1.4 * math.sin(y / 6) + .24 * math.sin(x / 2.5) + rng.uniform(-.10, .10)
            py = y + .90 * math.sin(x / 6) + .18 * math.sin(y / 2) + rng.uniform(-.10, .10)
            graph.add_node((x, y), x=101.48 + px * .0062, y=2.96 + py * .005)
    for y in range(rows):
        for x in range(cols):
            for dx, dy in ((1, 0), (0, 1), *(([(1, 1)] if x % 7 == 0 and y % 4 == 0 else []))):
                dest = (x + dx, y + dy)
                if dest not in graph:
                    continue
                if dx == 0 and x not in {8, 17, 28, 34} and (x + y) % 13 == 0:
                    continue
                a, b = graph.nodes[(x, y)], graph.nodes[dest]
                length = math.hypot((a["x"] - b["x"]) * 111000, (a["y"] - b["y"]) * 111000)
                speed = 65 if x % 9 == 0 or y % 8 == 0 else 35
                travel_time = length / (speed / 3.6)
                graph.add_edge((x, y), dest, length=length, travel_time=travel_time)
                graph.add_edge(dest, (x, y), length=length, travel_time=travel_time)
    origins = [(2, 5), (7, 2), (14, 1), (23, 2), (31, 3), (36, 6), (37, 13), (35, 21), (29, 26), (21, 27), (13, 26), (5, 23), (1, 16), (7, 11), (13, 8), (26, 8), (30, 16), (23, 22), (12, 20), (4, 18)]
    destination = (19, 14)
    loc = lambda node, name: Location(name, graph.nodes[node]["y"], graph.nodes[node]["x"])
    data = RenderInput("synthetic", tuple(loc(n, name) for n, name in zip(origins, NAMES)), loc(destination, "The meeting point"))
    return data, graph, origins, destination
