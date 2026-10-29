/** Presigned upload (F-41): presign → PUT to storage → complete → wait until verified. */
import { api, ApiError, unwrap } from "./api/client";

export type UploadKind = "sheet" | "document" | "image" | "data";

export interface UploadResult {
  id: string;
  file_id: string;
  is_duplicate: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function uploadFile(
  file: File,
  kind: UploadKind = "sheet",
  onProgress?: (fraction: number) => void,
): Promise<UploadResult> {
  const contentType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
  const presigned = await unwrap(
    api.POST("/api/v1/uploads/presign", { body: { filename: file.name, size: file.size, content_type: contentType, kind } }),
  );
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presigned.url);
    for (const [k, v] of Object.entries(presigned.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Storage refused the file (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("The upload was interrupted. Check your connection and try again."));
    xhr.send(file);
  });
  const id = presigned.upload.id;
  await unwrap(api.POST("/api/v1/uploads/{id}/complete", { params: { path: { id } } }));
  for (let attempt = 0; attempt < 120; attempt++) {
    const upload = await unwrap(api.GET("/api/v1/uploads/{id}", { params: { path: { id } } }));
    if (upload.state === "ready" && upload.file_id) return { id, file_id: upload.file_id, is_duplicate: !!upload.is_duplicate };
    if (upload.state === "rejected") throw new ApiError(400, { code: "upload_rejected", detail: `${file.name}: ${upload.reason}` });
    await sleep(attempt < 10 ? 300 : 1000);
  }
  throw new Error(`${file.name} is still being checked. Try again in a minute.`);
}
