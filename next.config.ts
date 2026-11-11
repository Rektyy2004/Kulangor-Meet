import type { NextConfig } from "next";
if(process.env.GOOGLE_MAPS_API_KEY && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY===process.env.GOOGLE_MAPS_API_KEY){
  throw new Error("Create a separate website-restricted browser key. The private server key must never be used in NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.");
}
const config: NextConfig = { poweredByHeader: false };
export default config;
