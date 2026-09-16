"use client";

import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { MapPin } from "lucide-react";

export type TerritoryPin = { label: string; total: number; applied: number };

// Real Google Map of your hunt. Pins are CITY-AREA level, geocoded live from
// your stored mission locations — exact office pins appear only where a
// verified street address exists (none yet: posts carry cities, not offices).
// Needs a one-time key (see notice below); without it the territory list
// below remains the full experience.
export function TerritoryMap({ pins }: { pins: TerritoryPin[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "nokey" | "error">("loading");
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

  useEffect(() => {
    if (!key) {
      setState("nokey");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setOptions({ key, v: "weekly" });
        const { Map } = await importLibrary("maps");
        const { Geocoder } = await importLibrary("geocoding");
        if (cancelled || !ref.current) return;
        const map = new Map(ref.current, {
          center: { lat: 22.97, lng: 78.65 },
          zoom: 5,
        });
        const geocoder = new Geocoder();
        const bounds = new google.maps.LatLngBounds();
        for (const pin of pins) {
          try {
            const loc = await new Promise<google.maps.LatLng | null>((resolve) => {
              geocoder.geocode({ address: `${pin.label}, India` }, (res, status) => {
                resolve(status === "OK" && res?.[0] ? res[0].geometry.location : null);
              });
            });
            if (!loc || cancelled) continue;
            const marker = new google.maps.Marker({
              map,
              position: loc,
              title: `${pin.label}: ${pin.total} missions (${pin.applied} engaged)`,
            });
            const info = new google.maps.InfoWindow({
              content: `<div style="color:#111;font-size:13px"><b>${pin.label}</b><br/>${pin.total} missions · ${pin.applied} engaged<br/><span style="color:#666">City area — exact office unverified</span></div>`,
            });
            marker.addListener("click", () => info.open(map, marker));
            bounds.extend(loc);
          } catch {
            /* one ungeocodable territory never breaks the rest */
          }
        }
        if (!bounds.isEmpty()) map.fitBounds(bounds);
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, pins]);

  if (state === "nokey" || state === "error") {
    return (
      <div className="os-panel flex items-start gap-2.5 p-4 text-sm">
        <MapPin size={16} className="mt-0.5 shrink-0 text-teal-200" aria-hidden />
        <div>
          <p className="font-semibold text-white">
            {state === "nokey" ? "Real map unlocks with one key" : "Map failed to load — list still works"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Google Maps needs a browser key with billing on your Google Cloud account (their rule, not
            mine — free monthly quota covers this usage many times over). Add{" "}
            <code className="rounded bg-black/40 px-1 text-cyan-200">NEXT_PUBLIC_GOOGLE_MAPS_KEY</code>{" "}
            to <code className="rounded bg-black/40 px-1 text-cyan-200">.env.local</code>, restart the
            site, and these territories render as live pins. Pins stay city-area until a verified
            office address exists — posts carry cities, not offices, so I never fake a pinpoint.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-teal-300/20">
      {state === "loading" && (
        <p className="bg-[#0d1428] p-4 text-sm text-zinc-400">Loading live map…</p>
      )}
      <div ref={ref} style={{ height: 380, width: "100%" }} aria-label="Map of mission territories" />
      <p className="bg-[#0d1428] px-3 py-1.5 text-[11px] text-zinc-500">
        City-area pins from your stored locations — exact office only where verified.
      </p>
    </div>
  );
}
