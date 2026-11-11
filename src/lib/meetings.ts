import type {Calculation,Configuration,MeetingSession,VenueSelection,CandidateResult,Place} from "./types";
import type {StoredSession} from "./store";
import {persistentStorage} from "./store";
import {googleConfigured,nearbyVenues,placeDetails,routeMatrix,routePolyline} from "./google";
import {geographicCentroid,rankCandidates,type Matrix} from "./fairness";
import {HttpError} from "./errors";

export function configuration():Configuration{return {googleConfigured:googleConfigured(),browserMapConfigured:Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),persistentStorage:persistentStorage()};}
export async function hydrateSession(stored:StoredSession):Promise<MeetingSession>{
  const participants=[];
  for(let offset=0;offset<stored.participants.length;offset+=5){
    participants.push(...await Promise.all(stored.participants.slice(offset,offset+5).map(async({placeId,editTokenHash:_private,...person})=>({...person,place:await placeDetails(placeId)}))));
  }
  return {id:stored.id,name:stored.name,capacity:stored.capacity,mode:stored.mode,createdAt:stored.createdAt,participants};
}

function centerResult(session:MeetingSession,place:Place,matrix:Matrix):CandidateResult{
  const valid=session.participants.map((person,i)=>({person,cell:matrix[i]?.[0]})).filter(row=>row.cell);
  const ranked=rankCandidates(valid.map(r=>r.person),[place],valid.map(r=>[r.cell!]))[0];
  return {...(ranked??{place,journeys:[],meanSeconds:0,standardDeviationSeconds:0,maxSeconds:0,minSeconds:0,rangeSeconds:0}),unreachableParticipantIds:session.participants.filter((_,i)=>!matrix[i]?.[0]).map(p=>p.id)};
}

async function attachLines(session:MeetingSession,result:CandidateResult,departure:string):Promise<number>{
  let missing=0;
  for(let offset=0;offset<result.journeys.length;offset+=5){
    await Promise.all(result.journeys.slice(offset,offset+5).map(async journey=>{
      const person=session.participants.find(p=>p.id===journey.participantId)!;
      try{journey.polyline=await routePolyline(person.place,result.place,departure);}catch{missing++;}
    }));
  }
  return missing;
}

export async function calculateLive(session:MeetingSession,departureTime:string,selected:VenueSelection[]=[]):Promise<Calculation>{
  if(!session.participants.length)throw new HttpError(400,"Add starting points before calculating.");
  const centroid=geographicCentroid(session.participants.map(p=>p.place));
  const centerPlace:Place={...centroid,id:"geographic-center",name:"Group center",address:`${centroid.lat.toFixed(5)}, ${centroid.lng.toFixed(5)}`,source:"computed"};
  const warnings:string[]=["Driving estimates use Google Maps traffic predictions. The average center may be off-road; routes may end at a nearby drivable point."];
  const [nearby,chosen]=await Promise.all([
    nearbyVenues(centroid).catch(()=>{warnings.push("Restaurant search is unavailable. Your center and personal selections are still calculated.");return [];}),
    Promise.all(selected.map(s=>placeDetails(s.placeId,s.sessionToken))),
  ]);
  const byId=new Map(nearby.map(p=>[p.id,p]));
  for(const place of chosen){
    const defined=Object.fromEntries(Object.entries(place).filter(([,value])=>value!==undefined));
    byId.set(place.id,{...byId.get(place.id),...defined} as Place);
  }
  const places=[...byId.values()];
  const matrix:Matrix=places.length?await routeMatrix(session.participants,places,departureTime):[];
  const candidates=rankCandidates(session.participants,places,matrix);
  for(const candidate of candidates)candidate.selectedByUser=selected.some(s=>s.placeId===candidate.place.id);
  const center=centerResult(session,centerPlace,await routeMatrix(session.participants,[centerPlace],departureTime));
  if(center.unreachableParticipantIds?.length)warnings.push(`${center.unreachableParticipantIds.length} people have no driving route to the average center. Their distances are not invented.`);
  const winner=candidates[0]??center;
  let missing=await attachLines(session,center,departureTime);
  if(winner!==center)missing+=await attachLines(session,winner,departureTime);
  if(missing)warnings.push(`${missing} route lines could not be loaded. Distances and travel times still use the routing matrix.`);
  if(nearby.length<10)warnings.push(`Found ${nearby.length} restaurant options within 5 km of the center; fewer than 10 may be available.`);
  warnings.push("Restaurant recommendations use popularity, rating and review counts from the nearby search pool, not a guarantee of quality or opening hours.");
  const excludedSelectedPlaces=chosen.filter(p=>!candidates.some(c=>c.place.id===p.id)).map(p=>({id:p.id,name:p.name,reason:"No driving route is available for at least one person."}));
  return {sessionId:session.id,departureTime,calculatedAt:new Date().toISOString(),mode:"live",centroid,center,candidates,winner,warnings,selectedPlaceIds:selected.map(s=>s.placeId),excludedSelectedPlaces};
}

export async function loadRouteLines(session:MeetingSession,destination:Place,departureTime:string):Promise<CandidateResult["journeys"]>{
  const result=rankCandidates(session.participants,[destination],await routeMatrix(session.participants,[destination],departureTime))[0];
  if(!result)throw new HttpError(422,"This place cannot be reached by everyone.");
  const missing=await attachLines(session,result,departureTime);
  if(missing)throw new HttpError(502,"Some route lines are temporarily unavailable. Please try again.");
  return result.journeys;
}
