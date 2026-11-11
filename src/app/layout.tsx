import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kulangor Meetup",
  description: "Find a fair meeting spot for your group across Kuala Lumpur and Selangor, with travel times that consider everyone.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
