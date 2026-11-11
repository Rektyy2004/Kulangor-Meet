import {describe,it,expect} from "vitest";
import {routeProgress} from "@/lib/route-progress";
describe("route playback",()=>{
  it("moves across the date line rather than around the world",()=>{
    const path=[{lat:0,lng:179},{lat:0,lng:-179}];
    expect(routeProgress(path,.5)).toEqual([{lat:0,lng:179},{lat:0,lng:-180}]);
    expect(routeProgress(path,.75).at(-1)?.lng).toBe(-179.5);
  });
  it("reveals distance along bends rather than jumping straight to the destination",()=>{
    const path=[{lat:0,lng:0},{lat:0,lng:3},{lat:4,lng:3}];
    expect(routeProgress(path,.5)).toEqual([{lat:0,lng:0},{lat:0,lng:3},{lat:.5,lng:3}]);
    expect(routeProgress(path,0)).toEqual([]);
    expect(routeProgress(path,1)).toEqual(path);
  });
});
