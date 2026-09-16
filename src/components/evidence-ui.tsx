"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Check, Copy } from "lucide-react";

export function UploadBox({ jobId }: { jobId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        form.append("jobId", String(jobId));
        const res = await fetch("/api/vault/upload", {
          method: "POST",
          body: form,
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "upload failed");
      }
      setMsg(`Stored ${files.length} file(s) — originals preserved, synced to vault.`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed — local files untouched.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed os-hud-line p-4 text-sm">
      <label className="flex cursor-pointer items-center gap-2 text-zinc-200">
        <Upload size={16} className="text-cyan-300" aria-hidden />
        <span className="font-semibold">
          {busy ? "Syncing…" : "Upload evidence (screenshots, PDFs, JD files)"}
        </span>
        <input
          type="file"
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => void onFiles(e.target.files)}
        />
      </label>
      {msg && <p className="mt-1 text-xs text-zinc-400">{msg}</p>}
    </div>
  );
}

export function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(email).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 rounded-md border os-hud-line px-2 py-0.5 text-xs text-cyan-200 hover:bg-white/5"
      aria-live="polite"
    >
      {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
      {copied ? "COPIED" : "COPY EMAIL"}
    </button>
  );
}
