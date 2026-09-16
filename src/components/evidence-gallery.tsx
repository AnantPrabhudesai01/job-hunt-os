"use client";

import { useState } from "react";
import { FileText, Image as ImageIcon, Eye } from "lucide-react";
import { DocumentPreviewModal } from "@/components/doc-modal";

export type GalleryAsset = {
  id: number;
  asset_type: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  local_path: string | null;
  storage_path: string | null;
  sync_status: string;
  source: string | null;
  confidence: string | null;
  created_at: string;
};

export function EvidenceGallery({
  assets,
  company,
  role,
}: {
  assets: GalleryAsset[];
  company?: string | null;
  role?: string;
}) {
  const [preview, setPreview] = useState<GalleryAsset | null>(null);

  if (assets.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        No evidence files yet. Upload screenshots, PDFs, or JD files below.
      </p>
    );
  }
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2">
        {assets.map((a) => (
          <li key={a.id} className="card-hover rounded-lg border os-hud-line p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                {a.asset_type === "SCREENSHOT" || (a.mime_type ?? "").startsWith("image/") ? (
                  <ImageIcon size={14} className="shrink-0 text-violet-300" aria-hidden />
                ) : (
                  <FileText size={14} className="shrink-0 text-cyan-300" aria-hidden />
                )}
                <span className="break-all">{a.file_name}</span>
              </span>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                  a.sync_status === "SYNCED"
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                    : "border-amber-400/40 bg-amber-400/10 text-amber-200"
                }`}
              >
                {a.sync_status === "SYNCED" ? "☁ SYNCED" : "⚠ LOCAL ONLY"}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {a.asset_type} ·{" "}
              {a.size_bytes ? `${Math.round(a.size_bytes / 1024)} KB` : "size unknown"} ·{" "}
              {a.created_at.slice(0, 10)}
            </p>
            {a.source && (
              <p className="text-xs text-zinc-500">
                Source: {a.source}
                {a.confidence ? ` (${a.confidence})` : ""}
              </p>
            )}
            <div className="mt-1.5">
              <button
                onClick={() => setPreview(a)}
                className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2.5 py-1 text-xs font-bold tracking-wider hover:bg-sky-500"
              >
                <Eye size={12} aria-hidden /> PREVIEW
              </button>
              {!a.storage_path && a.local_path && (
                <span className="ml-2 break-all font-mono text-[11px] text-zinc-500">
                  {a.local_path}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <DocumentPreviewModal
        target={preview ? { kind: "asset", id: preview.id } : null}
        head={
          preview
            ? {
                fileName: preview.file_name,
                company,
                role,
                type: preview.asset_type,
                sync:
                  preview.sync_status === "SYNCED" ? "☁ SYNCED" : "⚠ LOCAL ONLY",
              }
            : { fileName: "" }
        }
        onClose={() => setPreview(null)}
      />
    </>
  );
}
