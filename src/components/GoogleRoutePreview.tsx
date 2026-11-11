"use client";
import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import GoogleMap from "./GoogleMap";
import type { CandidateResult, MeetingSession } from "@/lib/types";

export default function GoogleRoutePreview({session,candidate}:{session:MeetingSession;candidate?:CandidateResult}) {
  const [progress,setProgress]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [mapReady,setMapReady]=useState(false);
  const routeCount=candidate?.journeys.filter(j=>j.polyline && j.polyline.length>1).length??0;
  const canPlay=mapReady && routeCount>0;
  useEffect(()=>{setProgress(0);setPlaying(false);},[session,candidate]);
  useEffect(()=>{
    if(!playing || !canPlay)return;
    let frame=0,last=0;
    const advance=(time:number)=>{
      const elapsed=last?Math.min(time-last,100):0;last=time;
      setProgress(value=>Math.min(1,value+elapsed/12000));frame=requestAnimationFrame(advance);
    };
    frame=requestAnimationFrame(advance);return()=>cancelAnimationFrame(frame);
  },[playing,canPlay]);
  useEffect(()=>{if(progress>=1)setPlaying(false);},[progress]);
  return <>
    <div className="map-container"><GoogleMap session={session} candidate={candidate} progress={progress} onReady={setMapReady}/></div>
    <div className="map-playback">
      <button className="icon-button" aria-label={playing?"Pause route preview":"Play route preview"} disabled={!canPlay} onClick={()=>{if(progress>=1)setProgress(0);setPlaying(value=>!value);}}>{playing?<Pause size={18}/>:<Play size={18}/>}</button>
      <button className="icon-button" aria-label="Replay routes" disabled={!canPlay} onClick={()=>{setProgress(0);setPlaying(true);}}><RotateCcw size={16}/></button>
      <input type="range" aria-label="Route preview progress" min="0" max="1000" value={Math.round(progress*1000)} disabled={!canPlay} onChange={e=>{setPlaying(false);setProgress(Number(e.target.value)/1000);}}/>
      <span>{Math.round(progress*100)}%</span>
    </div>
    <div className="route-preview-caption">{candidate?<><strong>To {candidate.place.name}</strong><span>{candidate.place.address}</span><span>{routeCount}/{candidate.journeys.length} road routes · 12-second animated preview</span>{routeCount<candidate.journeys.length && <span role="status">Some route lines are unavailable. Calculate again to retry.</span>}</>:<span>Add specific starting points, then calculate the center to play your journeys.</span>}</div>
  </>;
}
