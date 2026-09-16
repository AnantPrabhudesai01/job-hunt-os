"use client";

import { useEffect } from "react";

// Registers /sw.js once. Silent when unsupported or when registration fails
// (e.g. plain HTTP on a phone) — the site works fine without it.
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
