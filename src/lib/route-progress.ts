import type { Coordinate } from "./types";
const wrapLongitude=(value:number)=>(value+540)%360-180;
export function routeProgress(path: Coordinate[], progress: number): Coordinate[] {
  if (!path.length || progress <= 0) return [];
  if (progress >= 1) return path;
  const lengths = path.slice(1).map((p,i) => Math.hypot(wrapLongitude(p.lng-path[i].lng)*Math.cos(p.lat*Math.PI/180), p.lat-path[i].lat));
  let remaining = lengths.reduce((sum,n) => sum+n,0) * progress;
  const points = [path[0]];
  for (let i=0;i<lengths.length;i++) {
    if (remaining >= lengths[i]) { points.push(path[i+1]); remaining -= lengths[i]; }
    else { const t = lengths[i] ? remaining/lengths[i] : 0; points.push({lat:path[i].lat+(path[i+1].lat-path[i].lat)*t,lng:wrapLongitude(path[i].lng+wrapLongitude(path[i+1].lng-path[i].lng)*t)}); break; }
  }
  return points;
}
