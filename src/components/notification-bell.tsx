"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import type { Notice } from "@/lib/data";

// Notification bell: walk-ins ≤3d (own lane), overdue nudges, critical (≤3d)
// deadlines, missions unapplied 24h+. Computed server-side once per request.
export function NotificationBell({ notices }: { notices: Notice[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications, ${notices.length} unread`}
        aria-expanded={open}
        className="relative rounded-lg border os-hud-line p-1.5 text-zinc-300 hover:text-white"
      >
        <Bell size={15} aria-hidden />
        {notices.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {notices.length > 9 ? "9+" : notices.length}
          </span>
        )}
      </button>
      {open && (
        <div className="os-panel absolute right-0 top-full z-50 mt-1.5 max-h-[60vh] w-72 overflow-y-auto p-2">
          {notices.length === 0 ? (
            <p className="p-3 text-xs text-zinc-400">All quiet. No walk-ins, overdue nudges, critical deadlines, or stale missions.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {notices.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5"
                  >
                    <span
                      className={`shrink-0 rounded border px-1.5 py-px text-[10px] font-bold ${
                        n.kind === "WALKIN"
                          ? "border-yellow-300/50 bg-yellow-300/10 text-yellow-200"
                          : n.kind === "OVERDUE"
                            ? "border-orange-400/40 bg-orange-400/10 text-orange-200"
                            : n.kind === "CRITICAL"
                              ? "border-red-400/40 bg-red-400/10 text-red-200"
                              : "border-amber-300/40 bg-amber-300/10 text-amber-200"
                      }`}
                    >
                      {n.kind}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-zinc-200" title={n.text}>
                      {n.text}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
