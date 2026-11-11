"use client";
import {useEffect,useState} from "react";
import {ArrowRight,Check,LoaderCircle,MapPin,ShieldCheck} from "lucide-react";
import LocationSearch from "@/components/LocationSearch";
import type {Configuration,Suggestion} from "@/lib/types";
import styles from "./join.module.css";
type Invitation={id:string;name:string;capacity:number;participantCount:number;mode:"demo"|"live";configuration:Configuration};
type Access={participantId:string;editToken:string};
export default function JoinForm({id}:{id:string}){
  const [invitation,setInvitation]=useState<Invitation|null>(null);
  const [name,setName]=useState("");
  const [place,setPlace]=useState<Suggestion|null>(null);
  const [sessionToken,setSessionToken]=useState("");
  const [participantId,setParticipantId]=useState("");
  const [editToken,setEditToken]=useState("");
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [complete,setComplete]=useState(false);
  const [error,setError]=useState("");
  function headers():Record<string,string>{
    const organizer=localStorage.getItem(`kulangor-organizer-${id}`);
    return organizer?{"X-Organizer-Token":organizer}:editToken?{"X-Participant-Token":editToken}:{};
  }
  useEffect(()=>{
    let cancelled=false;
    async function open(){
      try{
        const response=await fetch(`/api/sessions/${encodeURIComponent(id)}/join`,{cache:"no-store"});
        const data=await response.json();if(!response.ok)throw new Error(data.error);if(cancelled)return;
        setInvitation(data);
        let access:Access|null=null;
        try{access=JSON.parse(localStorage.getItem(`kulangor-participant-${id}`)||"null");}catch{}
        const requested=new URLSearchParams(window.location.search).get("participantId") || access?.participantId;
        if(requested){
          const organizer=localStorage.getItem(`kulangor-organizer-${id}`);
          const token=access?.participantId===requested?access.editToken:"";
          const auth:Record<string,string>=organizer?{"X-Organizer-Token":organizer}:token?{"X-Participant-Token":token}:{};
          const own=await fetch(`/api/sessions/${id}/participants/${encodeURIComponent(requested)}`,{headers:auth,cache:"no-store"});
          const person=await own.json();if(!own.ok)throw new Error(person.error);if(cancelled)return;
          setParticipantId(person.id);setEditToken(token);setName(person.name);setPlace(person.place);
        }else if(localStorage.getItem(`kulangor-joined-${id}`)==="yes"){
          setError("Already added? Open the meetup and use Edit beside your name to avoid a duplicate.");
        }
      }catch(e){if(!cancelled)setError((e as Error).message||"This invitation could not be opened.");}
      finally{if(!cancelled)setLoading(false);}
    }
    void open();return()=>{cancelled=true;};
  },[id]);
  async function submit(event:React.FormEvent){
    event.preventDefault();if(!place || name.trim().length<2)return;
    setSubmitting(true);setError("");
    try{
      const response=await fetch(participantId?`/api/sessions/${id}/participants/${encodeURIComponent(participantId)}`:`/api/sessions/${id}/join`,{method:participantId?"PATCH":"POST",headers:{"Content-Type":"application/json",...headers()},body:JSON.stringify({name:name.trim(),placeId:place.id,...(sessionToken?{sessionToken}:{})})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not save your starting point.");
      if(!participantId){
        setParticipantId(data.participantId);setEditToken(data.editToken);
        localStorage.setItem(`kulangor-participant-${id}`,JSON.stringify({participantId:data.participantId,editToken:data.editToken}));
      }
      localStorage.setItem(`kulangor-updated-${id}`,String(Date.now()));
      localStorage.setItem(`kulangor-joined-${id}`,"yes");
      setComplete(true);
    }catch(e){setError((e as Error).message);}finally{setSubmitting(false);}
  }
  const full=!!invitation && invitation.participantCount>=invitation.capacity && !participantId;
  const ready=!!invitation?.configuration.googleConfigured && invitation.mode==="live";
  return <main className={styles.shell}><a href={`/?session=${id}`} className={styles.brand}><MapPin size={24}/>Kulangor Meetup</a><section className={styles.card}>
    {loading?<div className={styles.center}><LoaderCircle className="spin"/><p>Opening your starting point…</p></div>:complete?<div className={styles.center}><span className={styles.success}><Check size={30}/></span><h1>Starting point saved</h1><p>{place?.name}</p><button className="button button-blue" onClick={()=>setComplete(false)}>Change my starting point</button><a className="text-link" href={`/?session=${id}`}>Back to meetup</a></div>:invitation?<>
      <h1>{participantId?"Edit your starting point":"Add your starting point"}</h1><p>{invitation.name} · {invitation.participantCount}/{invitation.capacity} people</p>
      {full?<p>This meetup is full. Open the meetup and use Edit beside any name to change a starting point.</p>:<><p>Choose a street, landmark or specific neighborhood, e.g. Bandar Baru Sri Petaling. Whole towns like Subang or Klang are too broad for precise routes.</p>{!ready && <p className={styles.setup}>Location search is waiting for the organizer’s setup.</p>}<form onSubmit={submit} className={styles.form}><label htmlFor="participant-name">Your name</label><input className="text-input" id="participant-name" autoComplete="given-name" value={name} minLength={2} maxLength={50} required onChange={e=>setName(e.target.value)} disabled={submitting}/><label className={styles.locationLabel}>Starting point</label><LocationSearch mode="live" initialSelection={place??undefined} disabled={!ready||submitting} onSelect={(p,token)=>{setPlace(p);setSessionToken(token);}}/>
      <button type="submit" className={`button button-blue ${styles.submit}`} disabled={!ready||!place||name.trim().length<2||submitting}>{submitting?<LoaderCircle className="spin" size={17}/>:<MapPin size={17}/>} {submitting?"Saving…":participantId?"Save changes":"Add my starting point"}<ArrowRight size={17}/></button></form></>}
      {error && <p className="field-error" role="alert">{error}</p>}<p className={styles.privacy}><ShieldCheck size={16}/>Anyone with this meetup link can view and edit this location. Choose a nearby public landmark if you prefer.</p>
    </>:<div className={styles.center}><h1>Invitation unavailable</h1><p role="alert">{error}</p></div>}
  </section><footer className={styles.footer}><a href="/privacy">Privacy</a><a href="/terms">Terms</a></footer></main>;
}
