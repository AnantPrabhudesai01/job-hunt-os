"use client";

import { useEffect, useRef } from "react";

// Presence tracker: first visit, visit count, time on site — all into
// site_visits (one row per day). Heartbeat every 60s + final flush on hide.
// Silent and tiny; powers the Digest presence strip.
export function PresenceTracker() {
  const acc = useRef(0);
  const last = useRef(Date.now());
  const marked = useRef(false);

  useEffect(() => {
    const beat = (kind: "visit" | "tick", seconds: number) => {
      const body = JSON.stringify({ kind, seconds });
      if (kind === "tick" && document.visibilityState === "hidden" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/presence/beat", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/presence/beat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    };
    if (!marked.current) {
      marked.current = true;
      beat("visit", 0);
    }
    const id = setInterval(() => {
      const now = Date.now();
      acc.current += Math.round((now - last.current) / 1000);
      last.current = now;
      if (acc.current >= 60) {
        beat("tick", acc.current);
        acc.current = 0;
      }
    }, 30000);
    const flush = () => {
      const now = Date.now();
      acc.current += Math.round((now - last.current) / 1000);
      last.current = now;
      if (acc.current > 5) {
        beat("tick", acc.current);
        acc.current = 0;
      }
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  return null;
}
