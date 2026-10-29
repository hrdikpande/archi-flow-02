/** Cursor from a DRF CursorPagination `next` URL. */
export function cursorFrom(nextUrl: string | null | undefined): string | undefined {
  if (!nextUrl) return undefined;
  try {
    return new URL(nextUrl, "http://x").searchParams.get("cursor") ?? undefined;
  } catch {
    return undefined;
  }
}
