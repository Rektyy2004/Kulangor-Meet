"""Meaningful renderer checks: python -m unittest discover -s tests -p test_renderer.py"""
import math
import unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace

import networkx as nx

from renderer.compositor import Compositor, partial
from renderer.demo import synthetic_city
from renderer.model import RenderInput, analyze_graph, get_osm_graph


def payload():
    return {"source":"manual","independentCoordinates":True,"participants":[
        {"name":"Ahmad","lat":3.1,"lng":101.6}, {"name":"Sarah","lat":3.2,"lng":101.7}],
        "destination":{"name":"Meeting","lat":3.15,"lng":101.65}}


def road_graph():
    graph = nx.MultiDiGraph()
    for node in ("a","b","c","z"):
        graph.add_node(node,x=101.6,y=3.1)
    # A direct road has fewer hops but is much slower than the indirect route.
    graph.add_edge("a","z",key="direct",length=100,travel_time=90)
    graph.add_edge("a","b",key="slow-parallel",length=100,travel_time=30)
    graph.add_edge("a","b",key="fast-parallel",length=350,travel_time=10)
    graph.add_edge("b","c",key=0,length=250,travel_time=10)
    graph.add_edge("c","z",key=0,length=200,travel_time=10)
    return graph


class RendererTests(unittest.TestCase):
    def test_input_requires_a_json_object(self):
        with self.assertRaisesRegex(ValueError,"location object"):
            RenderInput.parse([])

    def test_weighted_dijkstra_preserves_fast_parallel_edge_and_length(self):
        graph = road_graph()
        routes = analyze_graph(graph,["a","b"],"z",["Ahmad","Sarah"])
        self.assertEqual(routes[0].nodes,["a","b","c","z"])
        self.assertEqual(routes[0].edges[0],("a","b","fast-parallel"))
        self.assertEqual(routes[0].seconds,30)
        self.assertEqual(routes[0].meters,800)
        self.assertEqual(routes[1].meters,450)

    def test_one_way_roads_are_never_reversed(self):
        with self.assertRaisesRegex(ValueError,"No directed driving route from Ahmad"):
            analyze_graph(road_graph(),["z","b"],"a",["Ahmad","Sarah"])

    def test_disconnected_origin_fails_instead_of_fake_route(self):
        graph = road_graph()
        graph.add_node("island",x=101.7,y=3.2)
        with self.assertRaisesRegex(ValueError,"No directed driving route from Sarah"):
            analyze_graph(graph,["a","island"],"z",["Ahmad","Sarah"])

    def test_negative_or_missing_weights_are_rejected(self):
        graph = road_graph()
        graph["a"]["z"]["direct"]["travel_time"] = -1
        with self.assertRaisesRegex(ValueError,"nonnegative finite travel_time"):
            analyze_graph(graph,["a","b"],"z",["Ahmad","Sarah"])

    def test_google_provenance_rejected_even_when_nested(self):
        data = payload()
        data["participants"][1]["metadata"]={"source":{"vendor":"Google Places"}}
        with self.assertRaisesRegex(ValueError,"Google-derived"):
            RenderInput.parse(data)

    def test_explicit_independent_coordinate_declaration_required(self):
        data = payload()
        del data["independentCoordinates"]
        with self.assertRaisesRegex(ValueError,"independentCoordinates"):
            RenderInput.parse(data)

    def test_nonfinite_and_boolean_coordinates_rejected(self):
        for value in [float("nan"),float("inf"),True]:
            data = payload()
            data["destination"]["lat"]=value
            with self.assertRaisesRegex(ValueError,"finite numbers"):
                RenderInput.parse(data)

    def test_reused_cache_cannot_silently_snap_to_another_city(self):
        graph = road_graph()
        fake_osmnx = SimpleNamespace(settings=SimpleNamespace(),io=SimpleNamespace(load_graphml=lambda _:graph),
            distance=SimpleNamespace(nearest_nodes=lambda *args,**kwargs:["a","b","z"]))
        with patch.dict("sys.modules",{"osmnx":fake_osmnx}), patch.object(Path,"exists",return_value=True):
            with self.assertRaisesRegex(ValueError,"cached graph may cover a different area"):
                get_osm_graph(RenderInput.parse(payload()),Path("old-city.graphml"))

    def test_demo_has_twenty_distinct_colors_and_reachable_directed_routes(self):
        data,graph,origins,destination = synthetic_city()
        journeys = analyze_graph(graph,origins,destination,[p.name for p in data.participants])
        self.assertEqual(len(journeys),20)
        self.assertEqual(len({j.color for j in journeys}),20)
        self.assertTrue(all(j.meters>0 and j.nodes[-1]==destination for j in journeys))
        self.assertTrue(all(graph.has_edge(u,v,k) for j in journeys for u,v,k in j.edges))

    def test_reveal_preserves_geometry_and_length(self):
        self.assertEqual(partial([(0,0),(3,0),(3,4)],.5),[(0,0),(3,0),(3,.5)])
        self.assertEqual(partial([(0,0),(3,0)],0),[])

    def test_road_front_can_enter_a_reciprocal_street_from_reverse_direction_first(self):
        graph = nx.MultiDiGraph()
        for i,node in enumerate(["a","b","c","d"]):
            graph.add_node(node,x=101.60+i*.001,y=3.1)
        # A->B is inserted first, but the first origin is B itself.
        graph.add_edge("a","b",length=100,travel_time=10)
        graph.add_edge("b","a",length=100,travel_time=10)
        graph.add_edge("b","c",length=100,travel_time=1)
        graph.add_edge("d","c",length=100,travel_time=1)
        data = RenderInput.parse(payload())
        journeys=analyze_graph(graph,["b","d"],"c",["Ahmad","Sarah"])
        scene=Compositor(data,graph,journeys,"c")
        reverse=[scene.node_points["b"],scene.node_points["a"]]
        self.assertTrue(any(points==reverse and start==0 for points,start,_,_ in scene.flood),
                        "The reverse B->A road front must activate immediately, before A is reached.")

    def test_parallel_streets_with_different_geometry_keep_separate_fronts(self):
        graph = nx.MultiDiGraph()
        for i,node in enumerate(["a","b","c"]):
            graph.add_node(node,x=101.60+i*.001,y=3.1)
        graph.add_edge("a","b",key="straight",length=100,travel_time=1)
        curve=SimpleNamespace(coords=[(101.60,3.1),(101.6005,3.1005),(101.601,3.1)])
        graph.add_edge("a","b",key="curve",length=140,travel_time=2,geometry=curve)
        graph.add_edge("b","c",length=100,travel_time=1)
        journeys=analyze_graph(graph,["a","b"],"c",["Ahmad","Sarah"])
        scene=Compositor(RenderInput.parse(payload()),graph,journeys,"c")
        self.assertEqual(len(scene.flood),3)
        self.assertTrue(any(len(points)==3 for points,_,_,_ in scene.flood))

    def test_compositor_has_export_dimensions_and_two_visual_phases(self):
        data,graph,origins,destination = synthetic_city()
        journeys = analyze_graph(graph,origins,destination,[p.name for p in data.participants])
        scene = Compositor(data,graph,journeys,destination)
        first,last=scene.frame(0),scene.frame(10)
        self.assertEqual(first.size,(1280,720))
        self.assertNotEqual(first.tobytes(),last.tobytes())


if __name__ == "__main__":
    unittest.main()
