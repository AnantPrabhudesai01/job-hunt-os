"use client";

import { useEffect, useState } from "react";
import { formatDayIST } from "@/lib/time";

function nowIST() {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date());
}

export function LiveClock() {
  const [t, setT] = useState("--:--");
  const [day, setDay] = useState("");
  useEffect(() => {
    const tick = () => {
      setT(nowIST());
      setDay(formatDayIST(new Date()));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-right" aria-live="off">
      <p className="font-display text-lg font-bold text-white tabular-nums">{t}</p>
      <p className="text-xs text-zinc-400">
        {day} IST
      </p>
    </div>
  );
}
