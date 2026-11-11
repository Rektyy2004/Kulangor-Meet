"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, HelpCircle, Link2, LoaderCircle, MapPin, RefreshCw, Users, X } from "lucide-react";
import type { Calculation, CandidateResult, Configuration, Journey, MeetingSession, SessionResponse, Suggestion } from "@/lib/types";
import LocationSearch from "./LocationSearch";
import GoogleRoutePreview from "./GoogleRoutePreview";
const keyName = (id:string) => `kulangor-organizer-${id}`;
const minutes = (seconds:number) => Math.round(seconds/60);
function localTime(date:Date) {
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kuala_Lumpur",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
  const get = (type:string) => parts.find(p=>p.type===type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
async function api<T>(url:string, options:RequestInit={}):Promise<T> {
  const res=await fetch(url,{cache:"no-store",...options});
  const body=await res.json();
  if(!res.ok) throw new Error(body.error || "Please try again.");
  return body;
}
type Choice = Suggestion & {sessionToken:string};
export default function Meetup() {
  const [session,setSession]=useState<MeetingSession|null>(null);
  const [config,setConfig]=useState<Configuration|null>(null);
  const [calculation,setCalculation]=useState<Calculation|null>(null);
  const [selectedId,setSelectedId]=useState("");
  const [choices,setChoices]=useState<Choice[]>([]);
  const [departure,setDeparture]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [modal,setModal]=useState<"instructions"|"invite"|null>(null);
  const [copied,setCopied]=useState(false);
  const [updateNotice,setUpdateNotice]=useState("");
  const revision=useRef("");
  const [hasOwnStartingPoint,setHasOwnStartingPoint]=useState(false);
  const started=useRef(false);
  const routeRequest=useRef(0);
  const dialog=useRef<HTMLElement>(null);
  const candidate=(selectedId==="geographic-center" ? calculation?.center : calculation?.candidates.find(c=>c.place.id===selectedId)) || calculation?.center || calculation?.winner;
  const stale=!!calculation && (new Date(`${departure}:00+08:00`).getTime()!==new Date(calculation.departureTime).getTime() || JSON.stringify(choices.map(p=>p.id).sort())!==JSON.stringify([...(calculation.selectedPlaceIds??[])].sort()));
  function auth(id:string):Record<string,string> { const token=localStorage.getItem(keyName(id)); return token ? {"X-Organizer-Token":token} : {}; }
  function post(id:string,body:unknown):RequestInit { return {method:"POST",headers:{"Content-Type":"application/json",...auth(id)},body:JSON.stringify(body)}; }
  useEffect(()=>{
    if(started.current) return; started.current=true;
    const time=localTime(new Date(Date.now()+86400000)); setDeparture(time);
    async function open() {
      try {
        const query=new URLSearchParams(window.location.search);
        const target=query.get("demo")==="1" ? "demo" : query.get("session") || localStorage.getItem("kulangor-current-session");
        let data:SessionResponse;
        if(target && target!=="demo") data=await api<SessionResponse>(`/api/sessions/${encodeURIComponent(target)}`,{headers:auth(target)});
        else if(target==="demo") data=await api<SessionResponse>("/api/sessions/demo");
        else {
          const created=await api<SessionResponse & {organizerToken:string}>("/api/sessions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Kulangor Meetup",capacity:20})});
          localStorage.setItem(keyName(created.session.id),created.organizerToken);
          localStorage.setItem("kulangor-current-session",created.session.id);
          data=created;
        }
        revision.current=data.revision??"";
        setSession(data.session); setConfig(data.configuration); setHasOwnStartingPoint(!!localStorage.getItem(`kulangor-participant-${data.session.id}`) || localStorage.getItem(`kulangor-joined-${data.session.id}`)==="yes");
        if(data.session.mode==="live") {
          localStorage.setItem("kulangor-current-session",data.session.id);
          window.history.replaceState({},"",`/?session=${data.session.id}`);
        } else {
          const result=await api<Calculation>("/api/sessions/demo/calculate",post("demo",{departureTime:new Date(`${time}:00+08:00`).toISOString()}));
          setCalculation(result); setSelectedId(result.center?.place.id??result.winner.place.id);
        }
      } catch(e) { setError(e instanceof Error?e.message:"Could not open your meetup."); }
      finally { setLoading(false); }
    }
    void open();
  },[]);
  useEffect(()=>{
    if(!modal || !dialog.current) return;
    const panel=dialog.current, previous=document.activeElement as HTMLElement;
    const oldOverflow=document.body.style.overflow; document.body.style.overflow="hidden";
    panel.querySelector<HTMLButtonElement>("button")?.focus();
    function keys(e:KeyboardEvent) {
      if(e.key==="Escape") setModal(null);
      if(e.key!=="Tab") return;
      const items=[...panel.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input')];
      const first=items[0],last=items[items.length-1];
      if(e.shiftKey && document.activeElement===first) {e.preventDefault();last?.focus();}
      else if(!e.shiftKey && document.activeElement===last) {e.preventDefault();first?.focus();}
    }
    panel.addEventListener("keydown",keys);
    return ()=>{panel.removeEventListener("keydown",keys);document.body.style.overflow=oldOverflow;previous?.focus();};
  },[modal]);
  const refresh=useCallback(async()=>{
    if(!session) return;
    setBusy(true);setError("");
    try {const data=await api<SessionResponse>(`/api/sessions/${session.id}`,{headers:auth(session.id)});revision.current=data.revision??"";setSession(data.session);setConfig(data.configuration);setCalculation(null);routeRequest.current++;}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  },[session]);
  useEffect(()=>{
    if(!session)return;
    let last=localStorage.getItem(`kulangor-updated-${session.id}`);
    const changed=()=>{const next=localStorage.getItem(`kulangor-updated-${session.id}`);if(next!==last){last=next;setHasOwnStartingPoint(!!localStorage.getItem(`kulangor-participant-${session.id}`));void refresh();}};
    window.addEventListener("focus",changed);window.addEventListener("storage",changed);
    return()=>{window.removeEventListener("focus",changed);window.removeEventListener("storage",changed);};
  },[session?.id,refresh]);
  useEffect(()=>{
    if(!session || session.mode!=="live")return;
    const id=session.id;let cancelled=false,inFlight=false;
    async function check(){
      if(document.hidden || inFlight)return;
      inFlight=true;
      try{
        const changed=await api<{revision:string}>(`/api/sessions/${id}/changes`);
        if(cancelled || changed.revision===revision.current)return;
        const data=await api<SessionResponse>(`/api/sessions/${id}`);
        if(cancelled)return;
        revision.current=data.revision??changed.revision;setSession(data.session);setConfig(data.configuration);
        setCalculation(null);routeRequest.current++;setUpdateNotice("Starting points updated. Calculate again when everyone is ready.");
      }catch{/* Keep existing data during a temporary connection failure. */}
      finally{inFlight=false;}
    }
    const timer=setInterval(()=>void check(),15000);
    window.addEventListener("focus",check);
    return()=>{cancelled=true;clearInterval(timer);window.removeEventListener("focus",check);};
  },[session?.id]);
  async function compare() {
    if(!session) return;
    const time=new Date(`${departure}:00+08:00`);
    if(!Number.isFinite(time.getTime()) || time.getTime()<Date.now()+300000) {setError("Choose a departure at least 5 minutes from now (Malaysia time).");return;}
    setBusy(true);setError("");setUpdateNotice("");const requestId=++routeRequest.current;
    try {
      const result=await api<Calculation>(`/api/sessions/${session.id}/calculate`,post(session.id,{departureTime:time.toISOString(),selectedPlaces:choices.map(c=>({placeId:c.id,sessionToken:c.sessionToken}))}));
      if(requestId!==routeRequest.current)return;
      setCalculation(result);setSelectedId(result.center?.place.id??result.winner.place.id);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function select(candidate:CandidateResult) {
    setSelectedId(candidate.place.id);setError("");
    const requestId=++routeRequest.current;
    if(!session || !calculation || session.mode==="demo" || !config?.browserMapConfigured || candidate.journeys.every(j=>j.polyline?.length)) return;
    try {
      const result=await api<{journeys:Journey[]}>(`/api/sessions/${session.id}/routes`,post(session.id,{placeId:candidate.place.id,departureTime:calculation.departureTime}));
      if(requestId!==routeRequest.current) return;
      setCalculation(previous=>previous?{...previous,candidates:previous.candidates.map(c=>c.place.id===candidate.place.id?{...c,journeys:c.journeys.map(j=>({...j,polyline:result.journeys.find(r=>r.participantId===j.participantId)?.polyline}))}:c)}:previous);
    }catch(e){if(requestId===routeRequest.current)setError((e as Error).message);}
  }
  const inviteUrl=typeof window!=="undefined" && session ? `${(process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/$/,"")}/?session=${session.id}` : "";
  async function copy() {try {await navigator.clipboard.writeText(inviteUrl);setCopied(true);}catch {setCopied(false);}}
  const addChoice=(place:Suggestion|null,sessionToken:string)=>{if(place)setChoices(previous=>previous.some(p=>p.id===place.id)?previous:[...previous,{...place,sessionToken}].slice(0,5));};
  return <div className="meetup-shell">
    <header className="meetup-header"><h1><MapPin aria-hidden="true" size={27}/>Kulangor Meetup</h1><div className="header-actions"><button className="button button-white" onClick={()=>setModal("instructions")}><HelpCircle size={17}/>Instructions</button><button className="button button-blue" onClick={()=>{setCopied(false);setModal("invite");}} disabled={!session || session.mode==="demo"}><Link2 size={17}/>Invite people</button></div></header>
    <main>
      {session?.mode==="live" && <p className="sharing-note">Anyone with this meetup link can view and edit starting points. Share it only with your group.</p>}
      {updateNotice && <p className="notice" role="status">{updateNotice}</p>}
      {session?.mode==="demo" && <p className="notice">Sample data · simulated travel times</p>}
      {error && <div className="error-banner" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={()=>setError("")}><X size={18}/></button></div>}
      <div className="overview-grid">
        <section className="card map-panel"><div className="panel-heading"><h2>Your group’s route preview</h2></div>
          {session ? <GoogleRoutePreview session={session} candidate={candidate}/> : <div className="preview-empty"><LoaderCircle className="spin"/><p>{loading?"Opening your meetup…":"Preview unavailable"}</p></div>}
        </section>
        <section className="card group-panel"><div className="panel-heading"><h2><Users size={18}/>People <span className="count">{session?.participants.length??0}/{session?.capacity??20}</span></h2><button className="icon-button" aria-label="Refresh people" disabled={busy || !session} onClick={refresh}><RefreshCw size={16}/></button></div>
          {candidate && <p className="people-destination">To {candidate.place.name}</p>}<div className="people-list">{session?.participants.map(person=>{const journey=candidate?.journeys.find(j=>j.participantId===person.id);return <div className="person" key={person.id}><span className="person-dot" style={{background:person.color}}/><div><strong>{person.name}</strong><small title={person.place.address}>{person.place.name}</small></div><div className="person-time">{journey?<><b>{(journey.distanceMeters/1000).toFixed(1)} km</b><small>{minutes(journey.durationSeconds)} min drive</small></>:candidate?<small>No driving route</small>:null}{session.mode!=="demo" && <a className="edit-person" aria-label={`Edit starting point for ${person.name}`} href={`/join/${session.id}?participantId=${person.id}`} target="_blank" rel="noreferrer">Edit</a>}</div></div>;})}{!loading && !session?.participants.length && <p className="empty-state">Add starting points or invite people.<br/>Up to 20 people.</p>}</div>
          <button className="button button-white join-own" disabled={!session || session.mode==="demo"} onClick={()=>window.open(`/join/${session?.id}`,"_blank","noopener,noreferrer")}><MapPin size={16}/>{hasOwnStartingPoint?"Edit my starting point":"Add my starting point"}</button>
        </section>
      </div>
      {calculation?.center && <section className="card center-summary"><div><h2>Group center</h2><p>{calculation.centroid.lat.toFixed(5)}, {calculation.centroid.lng.toFixed(5)}</p></div><div><strong>{calculation.center.journeys.length?`${minutes(calculation.center.meanSeconds)} min average drive`:"No driving routes"}</strong><p>{calculation.center.journeys.length}/{session?.participants.length} people reachable · approximate geographic average</p></div><button className="button button-white" onClick={()=>{setSelectedId("geographic-center");}}>View center journeys</button></section>}
      <section className="card compare-panel"><div className="search-row"><div className="restaurant-search"><label>Check your own restaurant</label><LocationSearch purpose="venue" mode={session?.mode??"live"} resetAfterSelect disabled={choices.length>=5 || !session || busy || session.mode==="demo"} onSelect={addChoice}/></div><div className="departure-field"><label htmlFor="departure">Departure · Malaysia time</label><input id="departure" aria-label="Departure date and time in Malaysia" type="datetime-local" value={departure} min={localTime(new Date(Date.now()+360000))} onChange={e=>setDeparture(e.target.value)}/></div><button className="button button-blue compare-button" disabled={loading || busy || !session || session.participants.length<1} onClick={compare}>{busy?<LoaderCircle className="spin" size={18}/>:null}{busy?"Comparing…":"Calculate center"}</button></div>
        {choices.length>0 && <div className="choice-chips">{choices.map(choice=><span key={choice.id}>{choice.name}<button aria-label={`Remove ${choice.name}`} onClick={()=>setChoices(p=>p.filter(c=>c.id!==choice.id))}><X size={14}/></button></span>)}<small>{choices.length}/5 selected</small></div>}
        {session && session.participants.length<1 && <p className="field-hint">Add a starting point to calculate your center and journeys.</p>}
        {calculation && <p className={stale?"stale-result":"result-time"}>{stale?"Selection or departure changed — compare again.":`Results for ${new Intl.DateTimeFormat("en-MY",{timeZone:"Asia/Kuala_Lumpur",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}).format(new Date(calculation.departureTime))} MYT`}</p>}
      </section>
      {calculation && <div className="results"><section><h2>Top 10 restaurants near the center</h2><p className="field-hint">Ratings and popularity from Google Maps.</p><div className="venue-grid">{calculation.candidates.filter(c=>c.place.recommendationRank || !c.selectedByUser).sort((a,b)=>(a.place.recommendationRank??99)-(b.place.recommendationRank??99)).slice(0,10).map(c=><PlaceCard key={c.place.id} candidate={c} selected={c.place.id===candidate?.place.id} best={c.place.id===calculation.winner.place.id} onClick={()=>select(c)}/>)}</div>{!calculation.candidates.some(c=>c.place.recommendationRank || !c.selectedByUser) && <p className="field-hint">No other restaurant recommendations are available nearby.</p>}</section><section><h2>Your selections</h2>{calculation.candidates.some(c=>c.selectedByUser)?<div className="venue-grid">{calculation.candidates.filter(c=>c.selectedByUser).map(c=><PlaceCard key={c.place.id} candidate={c} selected={c.place.id===candidate?.place.id} best={c.place.id===calculation.winner.place.id} onClick={()=>select(c)}/>)}</div>:<p className="field-hint">Search for a restaurant above, then compare it with the recommendations.</p>}</section>{calculation.excludedSelectedPlaces?.map(p=><p className="error-banner" key={p.id}>{p.name}: {p.reason}</p>)}<details className="estimate-notes"><summary>About these estimates</summary><p>The center is a geographic average. Restaurant order uses popularity, rating and review counts. Driving times depend on traffic; some locations may have no driving route.</p>{calculation.warnings.map(w=><p key={w}>{w}</p>)}</details></div>}
      <footer><a href="/privacy">Privacy</a><a href="/terms">Terms</a></footer>
    </main>
    {modal && <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}><section className="modal" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button className="modal-close icon-button" aria-label="Close dialog" onClick={()=>setModal(null)}><X size={20}/></button><h2 id="dialog-title">{modal==="instructions"?"Instructions":"Invite people"}</h2>{modal==="instructions"?<><ol className="instructions"><li>Add a street, landmark or specific neighborhood, such as Bandar Baru Sri Petaling. Avoid whole towns like Klang. Locations can be anywhere.</li><li>Anyone with the meetup link can edit any starting point. Changes refresh automatically. Maximum 20 people.</li><li>Choose a departure time in Malaysia time.</li><li>Optionally search and select up to 5 restaurants.</li><li>Press Calculate center. See each person’s km and drive time to the center, then select a restaurant to compare.</li><li>Press Play under the Google Map. Each colored person follows their driving route. Pause, replay or drag the progress slider.</li></ol><p className="field-hint">This is animated Google Map playback, not a downloadable video file. Streets and nearby places require a separate restricted browser key.</p></>:<><p>This link opens the shared meetup. Everyone can view and edit all starting points · up to 20 people.</p><div className="invite-copy"><input aria-label="Invitation link" readOnly value={inviteUrl} onFocus={e=>e.target.select()}/><button className="icon-button" aria-label="Copy invitation link" onClick={copy}>{copied?<Check size={18}/>:<Copy size={18}/>}</button></div>{copied && <p role="status" className="copied">Link copied.</p>}<a className="button button-blue" href={`/join/${session?.id}`} target="_blank" rel="noreferrer">Add my starting point</a>{inviteUrl.includes("localhost") && <p className="field-hint">Other devices need your published website address. A localhost link works only on this computer.</p>}</>}</section></div>}
  </div>;
}
function PlaceCard({candidate:c,selected,best,onClick}:{candidate:CandidateResult;selected:boolean;best:boolean;onClick:()=>void}) {
  const averageKm=c.journeys.length?c.journeys.reduce((sum,j)=>sum+j.distanceMeters,0)/c.journeys.length/1000:0;
  return <button className={`card venue-card ${selected?"selected":""}`} aria-pressed={selected} onClick={onClick}><div className="venue-title"><h3>{c.place.name}</h3>{c.place.recommendationRank && <span className="best-label">#{c.place.recommendationRank}</span>}</div><p>{c.place.address}</p>{c.place.rating!==undefined && <p className="restaurant-rating">★ {c.place.rating.toFixed(1)} · {(c.place.userRatingCount??0).toLocaleString()} reviews</p>}<div className="metrics"><div><span>Average distance</span><strong>{averageKm.toFixed(1)}<small> km</small></strong></div><div><span>Average drive</span><strong>{minutes(c.meanSeconds)}<small> min</small></strong></div><div><span>Longest drive</span><strong>{minutes(c.maxSeconds)}<small> min</small></strong></div></div><small className="time-range">Drives: {minutes(c.minSeconds)}–{minutes(c.maxSeconds)} min{selected?" · Showing journeys":""}</small></button>;
}
