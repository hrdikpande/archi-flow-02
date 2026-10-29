import { Download, Maximize2, Minus, Plus, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "./Button";
import { ErrorState, SkeletonRows } from "./States";

interface PdfViewerProps {
  url: string | null;
  filename: string;
  /** e.g. "Superseded on 20-Oct-2026 by C01. Do not use for construction." */
  supersededBanner?: string;
  onDownload?: () => void;
}

type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage>; destroy: () => Promise<void> };
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas: HTMLCanvasElement }) => { promise: Promise<void>; cancel: () => void };
};

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

/** PDF.js viewer: fit to width by default, zoom, scroll to pan (DESIGN.md §4 PdfViewer, F-47). */
export function PdfViewer({ url, filename, supersededBanner, onDownload }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Loaded document and failure are keyed by URL, so "loading" is derived, not stored.
  const [loaded, setLoaded] = useState<{ url: string; doc: PdfDoc } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [scale, setScale] = useState<number | "fit">("fit");
  const doc = url && loaded?.url === url ? loaded.doc : null;
  const error = url && failed === url ? "The PDF could not be opened." : "";
  const loading = !!url && !doc && !error;

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let opened: PdfDoc | null = null;
    loadPdfjs()
      .then((pdfjs) => pdfjs.getDocument({ url, withCredentials: false }).promise)
      .then((d) => {
        opened = d as unknown as PdfDoc;
        if (!cancelled) setLoaded({ url, doc: opened });
      })
      .catch(() => !cancelled && setFailed(url));
    return () => {
      cancelled = true;
      void opened?.destroy();
    };
  }, [url]);

  useEffect(() => {
    if (!doc || !canvasRef.current || !containerRef.current) return;
    let task: { cancel: () => void } | null = null;
    let cancelled = false;
    doc.getPage(1).then((page) => {
      if (cancelled || !canvasRef.current || !containerRef.current) return;
      const base = page.getViewport({ scale: 1 });
      const fit = (containerRef.current.clientWidth - 16) / base.width;
      const effective = scale === "fit" ? fit : scale;
      const ratio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: effective * ratio });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / ratio}px`;
      canvas.style.height = `${viewport.height / ratio}px`;
      const context = canvas.getContext("2d");
      if (!context) return;
      const render = page.render({ canvasContext: context, viewport, canvas });
      task = render;
      render.promise.catch(() => {});
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, scale]);

  const zoom = (factor: number) =>
    setScale((current) => {
      const base = current === "fit" ? 1 : current;
      return Math.min(8, Math.max(0.25, base * factor));
    });

  return (
    <section aria-label={`PDF viewer: ${filename}`} className="flex min-h-[420px] flex-col rounded-md border border-border bg-surface">
      {supersededBanner && (
        <div role="alert" className="flex items-center gap-2 border-2 px-3 py-2 text-body font-semibold" style={{ borderColor: "var(--flag-late-fg)", color: "var(--flag-late-fg)", background: "var(--flag-late-bg)" }}>
          <TriangleAlert size={16} aria-hidden="true" /> {supersededBanner}
        </div>
      )}
      <div className="flex items-center gap-1 border-b border-border px-2 py-1">
        <Button size="sm" variant="ghost" aria-label="Zoom out" onClick={() => zoom(1 / 1.25)} disabled={!doc}><Minus size={14} aria-hidden="true" /></Button>
        <Button size="sm" variant="ghost" aria-label="Zoom in" onClick={() => zoom(1.25)} disabled={!doc}><Plus size={14} aria-hidden="true" /></Button>
        <Button size="sm" variant="ghost" icon={<Maximize2 size={14} aria-hidden="true" />} onClick={() => setScale("fit")} disabled={!doc}>Fit width</Button>
        <span className="flex-1 truncate px-2 text-small text-muted">{filename}</span>
        {onDownload && <Button size="sm" icon={<Download size={14} aria-hidden="true" />} onClick={onDownload}>Download</Button>}
      </div>
      <div ref={containerRef} className="relative flex-1 overflow-auto bg-surface-muted p-2" tabIndex={0} role="region" aria-label="Drawing">
        {!url && <p className="p-6 text-body text-muted">No PDF uploaded for this revision yet.</p>}
        {loading && <SkeletonRows rows={3} label="Opening PDF" />}
        {error && <ErrorState message={error} />}
        <canvas ref={canvasRef} className={doc ? "mx-auto block bg-white shadow-overlay" : "hidden"} aria-hidden="true" />
      </div>
    </section>
  );
}
