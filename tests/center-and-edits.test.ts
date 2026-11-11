import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {addStoredParticipant,createStoredSession,getStoredSession,updateStoredParticipant,authorizeParticipant} from "@/lib/store";
import {geographicCentroid} from "@/lib/fairness";
import {rankRestaurants} from "@/lib/restaurant-ranking";
let directory:string;
beforeEach(async()=>{directory=await mkdtemp(path.join(tmpdir(),"kulangor-edit-"));vi.stubEnv("KULANGOR_DATA_DIR",directory);vi.stubEnv("SUPABASE_URL","");vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","");});
afterEach(async()=>{vi.unstubAllEnvs();await rm(directory,{recursive:true,force:true});});
describe("editable starting points and global center",()=>{
  it("updates a starting point in a full group without adding a duplicate",async()=>{
    const {stored}=await createStoredSession("Meetup",1);
    const joined=await addStoredParticipant(stored.id,{name:"Ahmad",placeId:"old",id:"member",editToken:"private-edit-token"});
    expect(()=>authorizeParticipant(joined.participants[0],"wrong")).toThrow();
    expect(()=>authorizeParticipant(joined.participants[0],"private-edit-token")).not.toThrow();
    await updateStoredParticipant(stored.id,"member",{name:"Ahmad",placeId:"new"});
    const updated=await getStoredSession(stored.id);
    expect(updated.participants).toHaveLength(1);
    expect(updated.participants[0].placeId).toBe("new");
    expect(updated.participants[0].editTokenHash).not.toBe("private-edit-token");
  });
  it("averages points across the date line near the date line instead of Greenwich",()=>{
    const center=geographicCentroid([{lat:1,lng:179},{lat:3,lng:-179}]);
    expect(center.lat).toBe(2);
    expect(Math.abs(center.lng)).toBe(180);
  });
  it("prioritizes established highly rated restaurants, excludes closed ones, and returns ten",()=>{
    const places=Array.from({length:12},(_,i)=>({id:String(i),name:`Restaurant ${i}`,address:"",lat:0,lng:0,source:"google" as const,rating:4,userRatingCount:100}));
    places[4]={...places[4],rating:4.8,userRatingCount:2000};
    const ranked=rankRestaurants([...places,{...places[4],id:"closed",businessStatus:"CLOSED_PERMANENTLY"}]);
    expect(ranked).toHaveLength(10);
    expect(ranked[0].id).toBe("4");
    expect(ranked.some(p=>p.id==="closed")).toBe(false);
  });
});
