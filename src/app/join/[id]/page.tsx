import type { Metadata } from "next";
import JoinForm from "./JoinForm";

export const metadata: Metadata = { title: "Join your group · Kulangor", robots: { index: false, follow: false } };
export default async function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JoinForm id={id} />;
}
