"use client";
import {useEffect,useRef,useState} from "react";
import {MapPin} from "lucide-react";
import {routeProgress} from "@/lib/route-progress";
import type {CandidateResult,MeetingSession,Coordinate} from "@/lib/types";
type Line={setMap:(map:unknown)=>void;setPath:(path:Coordinate[])=>void};
type Marker=HTMLElement & {map:unknown;position:Coordinate};
type RoadMap={fitBounds:(bounds:unknown,padding?:number)=>void;setCenter:(coordinate:Coordinate)=>void;setZoom:(zoom:number)=>void};
type GoogleApi={maps:{Map:new(node:HTMLElement,options:Record<string,unknown>)=>RoadMap;marker:{AdvancedMarkerElement:new(options:Record<string,unknown>)=>Marker};Polyline:new(options:Record<string,unknown>)=>Line;LatLngBounds:new()=>{extend:(coordinate:Coordinate)=>void}}};
declare global{interface Window{google?:GoogleApi;__kulangorMapsReady?:()=>void;gm_authFailure?:()=>void}}
let loader:Promise<GoogleApi>|null=null;
function loadMaps(key:string):Promise<GoogleApi>{
  if(window.google?.maps.marker?.AdvancedMarkerElement)return Promise.resolve(window.google);
  if(!loader)loader=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    const fail=()=>{clearTimeout(timeout);loader=null;delete window.__kulangorMapsReady;script.remove();reject(new Error("Google Maps could not load. Check billing, Maps JavaScript API, and the browser key’s website restrictions."));};
    const timeout=setTimeout(fail,20000);
    window.__kulangorMapsReady=()=>{clearTimeout(timeout);delete window.__kulangorMapsReady;if(window.google?.maps.marker?.AdvancedMarkerElement)resolve(window.google);else fail();};
    script.src="https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(key)+"&loading=async&libraries=marker&v=weekly&callback=__kulangorMapsReady";
    script.async=true;script.onerror=fail;document.head.appendChild(script);
  });
  return loader;
}
function personContent(color:string,name:string,area:string){
  const node=document.createElement("div");node.className="member-map-marker";node.style.setProperty("--member-color",color);
  const badge=document.createElement("span");badge.className="member-map-avatar";
  // Fixed SVG only. User text is assigned through textContent.
  badge.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="11" r="5" fill="currentColor"/><path d="M6 27c0-10 20-10 20 0" fill="currentColor"/></svg>';
  const label=document.createElement("span");label.className="member-map-label";label.textContent=name+" · "+area;
  node.append(label,badge);return node;
}
export default function GoogleMap({session,candidate,progress=1,onReady}:{session:MeetingSession;candidate?:CandidateResult;progress?:number;onReady?:(ready:boolean)=>void}){
  const element=useRef<HTMLDivElement>(null);
  const mapInstance=useRef<RoadMap|null>(null);
  const tracks=useRef<{line:Line;glow:Line;path:Coordinate[];marker:Marker}[]>([]);
  const currentProgress=useRef(progress);currentProgress.current=progress;
  const ready=useRef(onReady);ready.current=onReady;
  const [error,setError]=useState("");const [loading,setLoading]=useState(true);
  const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  useEffect(()=>{
    ready.current?.(false);
    if(!key || !element.current)return;
    let cancelled=false;const lines:Line[]=[],markers:Marker[]=[];tracks.current=[];
    const authFailure=()=>{if(!cancelled){setLoading(false);setError("Google Maps rejected the browser key. Enable Maps JavaScript API and billing, then check its website restrictions.");ready.current?.(false);}};
    window.gm_authFailure=authFailure;
    loadMaps(key).then(api=>{
      if(cancelled || !element.current)return;
      const map=mapInstance.current??new api.maps.Map(element.current,{mapId:process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID",center:session.participants[0]?.place??{lat:3.139,lng:101.6869},zoom:session.participants.length?13:10,minZoom:2,maxZoom:19,disableDefaultUI:true,zoomControl:true,fullscreenControl:true,gestureHandling:"cooperative"});
      mapInstance.current=map;
      const bounds=new api.maps.LatLngBounds();
      for(const person of session.participants){
        bounds.extend(person.place);
        const path=candidate?.journeys.find(j=>j.participantId===person.id)?.polyline;
        const revealed=path?.length?routeProgress(path,currentProgress.current):[];
        const marker=new api.maps.marker.AdvancedMarkerElement({map,position:revealed.at(-1)??path?.[0]??person.place,title:person.name+" · "+person.place.address,zIndex:20});
        marker.append(personContent(person.color,person.name,person.place.name));markers.push(marker);
        if(!path?.length)continue;
        for(const point of path)bounds.extend(point);
        const origin=new api.maps.marker.AdvancedMarkerElement({map,position:person.place,title:person.name+" starts here: "+person.place.address,zIndex:2});
        const dot=document.createElement("span");dot.className="map-origin-dot";dot.style.background=person.color;origin.append(dot);markers.push(origin);
        const contextLine=new api.maps.Polyline({map,path,strokeColor:person.color,strokeOpacity:.25,strokeWeight:5,zIndex:1,clickable:false});
        const glow=new api.maps.Polyline({map,path:revealed,strokeColor:"#ffffff",strokeOpacity:.95,strokeWeight:9,zIndex:2,clickable:false});
        const line=new api.maps.Polyline({map,path:revealed,strokeColor:person.color,strokeOpacity:1,strokeWeight:5,zIndex:3,clickable:false});
        lines.push(contextLine,glow,line);tracks.current.push({line,glow,path,marker});
      }
      if(candidate){bounds.extend(candidate.place);const destination=new api.maps.marker.AdvancedMarkerElement({map,position:candidate.place,title:candidate.place.address,zIndex:10});const pin=document.createElement("div");pin.className="destination-map-marker";pin.textContent="● "+candidate.place.name;destination.append(pin);markers.push(destination);}
      if(session.participants.length>1 || candidate)map.fitBounds(bounds,65);
      else if(session.participants.length===1){map.setCenter(session.participants[0].place);map.setZoom(14);}
      setLoading(false);setError("");ready.current?.(true);
    }).catch(e=>{if(!cancelled){setLoading(false);setError(e.message);ready.current?.(false);}});
    return()=>{cancelled=true;lines.forEach(line=>line.setMap(null));markers.forEach(marker=>{marker.map=null;});tracks.current=[];if(window.gm_authFailure===authFailure)delete window.gm_authFailure;};
  },[key,session,candidate]);
  useEffect(()=>{for(const {line,glow,path,marker} of tracks.current){const shown=routeProgress(path,progress);line.setPath(shown);glow.setPath(shown);marker.position=shown.at(-1)??path[0];}},[progress]);
  return <div className="real-map-frame"><div className="google-map" ref={element} aria-label="Google road map of member starting points and destination"/>{(!key || error)?<div className="map-empty map-status"><MapPin size={32}/><h3>{error?"Map unavailable":"Connect Google Maps"}</h3><p>{error || "A separate website-restricted Maps JavaScript key is needed to show streets, places and route playback."}</p>{!key && <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>}<a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noreferrer">Google Cloud key settings</a></div>:loading && <div className="map-status map-empty" role="status">Loading Google Maps…</div>}</div>;
}
