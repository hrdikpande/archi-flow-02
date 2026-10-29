import { useQueryClient } from "@tanstack/react-query";
import { FileUp } from "lucide-react";
import { type DragEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { api, unwrap } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { uploadFile } from "@/lib/upload";
import { projectKeys } from "@/features/projects/api";

import type { Sheet } from "./useSheets";

interface Item {
  file: File;
  sheetId: string;
  /** Set once the file is uploaded (title-block reading uploads first, F-50). */
  uploadId?: string;
  status: "waiting" | "uploading" | "done" | "error";
  progress: number;
  message: string;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Match a file to a sheet by the sheet number in its name. Files that do not match can be
 * matched by their title-block text on the server (F-50). */
export function matchSheet(fileName: string, sheets: Pick<Sheet, "id" | "number" | "aliases">[]): string {
  const stem = fileName.replace(/\.[^.]+$/, "");
  const hits = sheets.filter((s) =>
    [s.number, ...s.aliases].some((n) => new RegExp(`(?<![A-Za-z0-9])${escape(n)}(?![A-Za-z0-9])`, "i").test(stem)),
  );
  // Prefer the longest number (A-101 inside A-101A is not a match thanks to the boundaries).
  return hits.sort((a, b) => b.number.length - a.number.length)[0]?.id ?? "";
}

/** UploadDropzone (DESIGN.md §4): many PDFs at once, matched to sheets, progress per file. */
export function UploadPdfs({ projectId, sheets, onDone }: { projectId: string; sheets: Sheet[]; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);

  const add = (files: FileList | File[]) => {
    const pdfs = [...files].filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    setItems((list) => [...list, ...pdfs.map((file) => ({ file, sheetId: matchSheet(file.name, sheets), status: "waiting" as const, progress: 0, message: "" }))]);
  };
  const update = (i: number, patch: Partial<Item>) => setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const start = async () => {
    setRunning(true);
    for (let i = 0; i < items.length; i++) {
      const it = items[i]!;
      if (it.status === "done" || !it.sheetId) continue;
      update(i, { status: "uploading", progress: 0, message: "" });
      try {
        const uploadId = it.uploadId ?? (await uploadFile(it.file, "sheet", (p) => update(i, { progress: p }))).id;
        const revision = await unwrap(api.POST("/api/v1/sheets/{id}/revisions", { params: { path: { id: it.sheetId } }, body: { upload_id: uploadId } }));
        update(i, { status: "done", progress: 1, message: `Draft ${revision.code}` });
      } catch (e) {
        update(i, { status: "error", message: e instanceof Error ? e.message : "Failed" });
      }
    }
    setRunning(false);
    queryClient.invalidateQueries({ queryKey: projectKeys.sheets(projectId) });
  };

  const [reading, setReading] = useState(false);
  /** F-50: upload the unmatched files, then let the server read their title blocks. */
  const readTitleBlocks = async () => {
    setReading(true);
    const todo = items.map((it, i) => ({ it, i })).filter(({ it }) => !it.sheetId && it.status !== "done");
    const ids: { i: number; uploadId: string }[] = [];
    for (const { it, i } of todo) {
      try {
        update(i, { status: "uploading", progress: 0, message: "Reading title block…" });
        const up = it.uploadId ?? (await uploadFile(it.file, "sheet", (p) => update(i, { progress: p }))).id;
        update(i, { uploadId: up, status: "waiting" });
        ids.push({ i, uploadId: up });
      } catch (e) {
        update(i, { status: "error", message: e instanceof Error ? e.message : "Failed" });
      }
    }
    if (ids.length) {
      try {
        const rows = await unwrap(api.POST("/api/v1/projects/{project_pk}/title-blocks", { params: { path: { project_pk: projectId } }, body: { upload_ids: ids.map((x) => x.uploadId) } }));
        for (const row of rows) {
          const { i } = ids.find((x) => x.uploadId === row.upload_id)!;
          const how = row.method === "ocr" ? "scanned page, read by OCR" : "title block";
          update(i, row.sheet && row.confidence >= 0.6
            ? { sheetId: row.sheet, message: `Matched ${row.sheet_number} from the ${how}${row.revision ? ` · title block rev ${row.revision}` : ""}${row.confidence < 0.9 ? " · check it" : ""}` }
            : { message: `Title block did not identify a sheet (${how}). Pick the sheet.` });
        }
      } catch (e) {
        for (const { i } of ids) update(i, { message: e instanceof Error ? e.message : "Could not read title blocks" });
      }
    }
    setReading(false);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    add(e.dataTransfer.files);
  };
  const unmatched = items.filter((i) => !i.sheetId).length;
  const finished = items.length > 0 && items.every((i) => i.status === "done" || !i.sheetId);

  return (
    <div className="flex flex-col gap-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 text-center", dragging ? "border-primary bg-surface-muted" : "border-border")}
      >
        <FileUp size={24} aria-hidden="true" className="text-muted" />
        <span className="text-body">Drop PDFs here or <span className="text-primary underline">choose files</span></span>
        <span className="text-small text-muted">One PDF per sheet. Files are matched by the sheet number in the file name.</span>
        <input type="file" multiple accept="application/pdf" className="sr-only" onChange={(e) => e.target.files && add(e.target.files)} />
      </label>
      {items.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {items.map((it, i) => (
            <li key={`${it.file.name}-${i}`} className="flex flex-col gap-1 p-2">
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-body" title={it.file.name}>{it.file.name}</span>
                <Select aria-label={`Sheet for ${it.file.name}`} className="h-7 w-36" value={it.sheetId} disabled={it.status !== "waiting" && it.status !== "error"} onChange={(e) => update(i, { sheetId: e.target.value })}>
                  <option value="">Pick sheet…</option>
                  {sheets.map((s) => <option key={s.id} value={s.id}>{s.number}</option>)}
                </Select>
              </div>
              {it.status === "uploading" && <progress className="h-1 w-full" max={1} value={it.progress} aria-label={`Uploading ${it.file.name}`} />}
              {it.message && <span className={cn("text-small", it.status === "error" ? "text-danger" : "text-muted")}>{it.message}</span>}
            </li>
          ))}
        </ul>
      )}
      {unmatched > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-small text-muted">{unmatched} file(s) did not match a sheet by name. Read their title blocks, or pick the sheet; unmatched files are skipped.</p>
          <Button size="sm" busy={reading} disabled={running} onClick={readTitleBlocks}>Read title blocks</Button>
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="primary" busy={running} disabled={!items.some((i) => i.sheetId && i.status !== "done")} onClick={start}>Upload {items.filter((i) => i.sheetId && i.status !== "done").length} PDFs</Button>
        <Button onClick={onDone}>{finished ? "Done" : "Close"}</Button>
      </div>
    </div>
  );
}
