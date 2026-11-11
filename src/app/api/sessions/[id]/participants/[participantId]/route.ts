import {getStoredSession,updateStoredParticipant} from "@/lib/store";
import {errorResponse,HttpError,requestBody,textField} from "@/lib/errors";
import {placeDetails} from "@/lib/google";
import {rateLimit,clientKey} from "@/lib/rate-limit";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string;participantId:string}>};
async function own(request:Request,context:Context){
  const {id,participantId}=await context.params;
  const stored=await getStoredSession(id);
  const participant=stored.participants.find(p=>p.id===participantId);
  if(!participant)throw new HttpError(404,"Starting point not found.");
  return {id,participantId,participant};
}
export async function GET(request:Request,context:Context){
  try{
    const {participant}=await own(request,context);
    return Response.json({id:participant.id,name:participant.name,place:await placeDetails(participant.placeId)},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return errorResponse(error);}
}
export async function PATCH(request:Request,context:Context){
  try{
    const {id,participantId}=await own(request,context);
    rateLimit(`edit:${clientKey(request)}:${id}`,20);
    const body=await requestBody(request);
    const name=textField(body.name,"Your name",2,50),placeId=textField(body.placeId,"Selected location",1,255);
    if(placeId.startsWith("demo-"))throw new HttpError(400,"Choose a real mapped location.");
    const token=body.sessionToken?textField(body.sessionToken,"Search session",1,64):undefined;
    await placeDetails(placeId,token);
    await updateStoredParticipant(id,participantId,{name,placeId});
    return Response.json({success:true},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return errorResponse(error);}
}
