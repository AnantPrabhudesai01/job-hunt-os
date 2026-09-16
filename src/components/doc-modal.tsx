"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, Copy, Check, ExternalLink, FileText, ZoomIn, ZoomOut } from "lucide-react";

export type PreviewTarget =
  | { kind: "doc"; id: number }
  | { kind: "asset"; id: number };

type Content =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "localonly"; fileName: string; message: string }
  | { kind: "text"; text: string; fileName: string }
  | { kind: "pdf"; url: string; fileName: string }
  | { kind: "image"; url: string; fileName: string }
  | { kind: "file"; url: string; fileName: string };

function CopyWholeButton({ getText }: { getText: () => string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  return (
    <button
      onClick={() => {
        const full = getText(); // complete source text, never the visible slice
        void navigator.clipboard
          .writeText(full)
          .then(() => {
            setState("done");
            setTimeout(() => setState("idle"), 1800);
          })
          .catch(() => setState("fail"));
      }}
      className="inline-flex items-center gap-1.5 rounded-md bg-cyan-500/20 border border-cyan-400/50 px-3 py-1.5 text-xs font-bold tracking-wider text-cyan-100 hover:bg-cyan-500/30"
      aria-live="polite"
    >
      {state === "done" ? (
        <>
          <Check size={13} aria-hidden /> ✓ COPIED
        </>
      ) : (
        <>
          <Copy size={13} aria-hidden /> 📋 COPY WHOLE
        </>
      )}
      {state === "fail" && <span className="font-normal"> — unable to copy automatically</span>}
    </button>
  );
}

function TextViewer({ text }: { text: string }) {
  const ref = useRef<HTMLPreElement>(null);
  return (
    <pre
      ref={ref}
      className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border os-hud-line bg-black/40 p-4 text-left font-mono text-[13px] leading-relaxed text-zinc-200 md:max-h-[55vh]"
    >
      {text}
    </pre>
  );
}

function ImageViewer({ url, name }: { url: string; name: string }) {
  const [zoom, setZoom] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          onClick={() => setZoom((z) => !z)}
          className="inline-flex items-center gap-1 rounded-md border os-hud-line px-2.5 py-1 text-xs text-zinc-200 hover:bg-white/5"
        >
          {zoom ? <ZoomOut size={12} aria-hidden /> : <ZoomIn size={12} aria-hidden />}
          {zoom ? "Fit to screen" : "Zoom"}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border os-hud-line px-2.5 py-1 text-xs text-cyan-200 hover:bg-white/5"
        >
          <ExternalLink size={12} aria-hidden /> OPEN ORIGINAL
        </a>
      </div>
      <div className="overflow-auto rounded-lg border os-hud-line bg-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          className={zoom ? "max-w-none" : "mx-auto max-h-[55vh] w-auto"}
        />
      </div>
    </div>
  );
}

export function DocumentPreviewModal({
  target,
  head,
  onClose,
}: {
  target: PreviewTarget | null;
  head: {
    fileName: string;
    company?: string | null;
    role?: string;
    type?: string;
    sync?: string;
  };
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [content, setContent] = useState<Content>({ kind: "loading" });
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!target) return;
    setContent({ kind: "loading" });
    const q = target.kind === "doc" ? `id=${target.id}` : `assetId=${target.id}`;
    fetch(`/api/docs/content?${q}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setContent({ kind: "error", message: j.error });
        else if (j.kind === "text")
          setContent({ kind: "text", text: j.text, fileName: j.fileName });
        else if (j.kind === "pdf" || j.kind === "image" || j.kind === "file")
          setContent({ kind: j.kind, url: j.url, fileName: j.fileName });
        else setContent({ kind: "localonly", fileName: j.fileName, message: j.message });
      })
      .catch(() => setContent({ kind: "error", message: "Network failed. Retry." }));
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [target, onClose]);

  const close = useCallback(onClose, [onClose]);

  return (
    <AnimatePresence>
      {target && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.18 }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={close}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Preview ${head.fileName}`}
            initial={reduce ? {} : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            className="os-panel relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden border-cyan-400/20 shadow-[0_0_60px_rgba(34,211,238,0.15)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div className="flex items-start justify-between gap-3 border-b os-hud-line p-4">
              <div className="flex items-center gap-2.5">
                <FileText size={20} className="shrink-0 text-cyan-300" aria-hidden />
                <div>
                  <p className="break-all font-display text-sm font-bold text-white md:text-base">
                    {head.fileName}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {[head.company, head.role, head.type].filter(Boolean).join(" • ")}
                    {head.sync ? ` · ${head.sync}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {content.kind === "text" && (
                  <CopyWholeButton getText={() => content.text} />
                )}
                {(content.kind === "pdf" ||
                  content.kind === "image" ||
                  content.kind === "file") && (
                  <a
                    href={content.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border os-hud-line px-3 py-1.5 text-xs font-bold tracking-wider text-zinc-100 hover:bg-white/5"
                  >
                    OPEN
                  </a>
                )}
                <button
                  ref={closeRef}
                  onClick={close}
                  className="rounded-md border os-hud-line px-3 py-1.5 text-xs font-bold tracking-wider text-zinc-100 hover:bg-white/5"
                >
                  <X size={13} className="mr-1 inline" aria-hidden />
                  CLOSE
                </button>
              </div>
            </div>
            {/* CONTENT */}
            <div className="overflow-y-auto p-4">
              {content.kind === "loading" && (
                <p className="py-10 text-center font-display text-sm tracking-[0.2em] text-cyan-200">
                  OPENING DOCUMENT…
                </p>
              )}
              {content.kind === "error" && (
                <div className="py-8 text-center">
                  <p className="font-bold text-white">DOCUMENT PREVIEW UNAVAILABLE</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {head.fileName} — {content.message}
                  </p>
                  <button
                    onClick={() => setContent({ kind: "loading" })}
                    className="mt-3 rounded-md border os-hud-line px-3 py-1.5 text-xs hover:bg-white/5"
                  >
                    Retry
                  </button>
                </div>
              )}
              {content.kind === "localonly" && (
                <div className="py-8 text-center">
                  <p className="font-bold text-white">⚠ LOCAL ONLY</p>
                  <p className="mx-auto mt-1 max-w-md text-sm text-zinc-400">
                    {content.message} The file remains safe on your disk —
                    nothing was lost.
                  </p>
                </div>
              )}
              {content.kind === "text" && <TextViewer text={content.text} />}
              {content.kind === "pdf" && (
                <iframe
                  src={content.url}
                  title={content.fileName}
                  className="h-[60vh] w-full rounded-lg border os-hud-line bg-white md:h-[65vh]"
                />
              )}
              {content.kind === "image" && (
                <ImageViewer url={content.url} name={content.fileName} />
              )}
              {content.kind === "file" && (
                <div className="py-8 text-center">
                  <p className="text-sm text-zinc-300">
                    No inline preview for this format.
                  </p>
                  <a
                    href={content.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold hover:bg-sky-500"
                  >
                    Open / Download
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
