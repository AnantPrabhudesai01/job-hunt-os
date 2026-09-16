import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { GameHUD } from "@/components/hud";
import { SideNav } from "@/components/side-nav";
import { PresenceTracker } from "@/components/presence-tracker";
import { SwRegister } from "@/components/sw-register";
import { getStats } from "@/lib/data";
import type { Notice } from "@/lib/data";
import { levelFor } from "@/lib/game";

export const metadata: Metadata = {
  title: "Anant Job Hunt OS",
  description: "Personal career command center",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "JobHunt" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport = { themeColor: "#0a0f22" };

const body = Inter({ variable: "--font-body", subsets: ["latin"] });
const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let level = 1;
  let title = "Recruit";
  let xp = 0;
  let pct = 0;
  let streak = 0;
  let active = 0;
  let notices: Notice[] = [];
  try {
    const stats = await getStats();
    xp = stats.totalXp;
    streak = stats.streak;
    active = stats.activeMissions;
    notices = stats.notices;
    const l = levelFor(xp);
    level = l.cur.n;
    title = l.cur.title;
    pct = l.next
      ? Math.min(100, Math.round(((xp - l.cur.minXp) / (l.next.minXp - l.cur.minXp)) * 100))
      : 100;
  } catch {
    // Logged-out pages (login/register): rail shows idle state.
  }

  return (
    <html lang="en" className="h-full">
      <body
        className={`${body.variable} ${display.variable} min-h-full`}
      >
        <GameHUD totalXp={xp} active={active} notices={notices} />
        <PresenceTracker />
        <SwRegister />
        <div className="mx-auto flex max-w-6xl flex-col pb-20 md:h-[calc(100vh-57px)] md:flex-row md:overflow-hidden md:pb-0">
          <SideNav level={level} title={title} xp={xp} pct={pct} streak={streak} />
          <main className="w-full flex-1 px-4 py-5 md:overflow-y-auto md:px-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
