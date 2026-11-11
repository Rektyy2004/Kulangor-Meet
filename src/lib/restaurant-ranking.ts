import type {Place} from "./types";
export function rankRestaurants(places:Place[]):Place[] {
  const score=(p:Place)=>{
    const votes=Math.max(0,p.userRatingCount??0), rating=p.rating??0;
    return rating ? (votes*rating+50*4)/(votes+50)+.15*Math.log10(Math.max(1,votes)) : -1;
  };
  return [...new Map(places.filter(p=>!p.businessStatus?.startsWith("CLOSED")).map(p=>[p.id,p])).values()]
    .sort((a,b)=>score(b)-score(a)||(b.userRatingCount??0)-(a.userRatingCount??0)||a.id.localeCompare(b.id))
    .slice(0,10).map((p,index)=>({...p,recommendationRank:index+1}));
}
