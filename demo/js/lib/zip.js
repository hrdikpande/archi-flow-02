/* DrawingOps demo · ZIP (store) writer, ZIP reader (store + deflate via DecompressionStream),
   and minimal XLSX write/read. No dependencies; works offline. */
(function (root) {
  "use strict";
  const DO = (root.DO = root.DO || {});
  const enc = new TextEncoder();

  const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

  /** files: [{ name, data: Uint8Array | string }] → Uint8Array (stored, no compression). */
  function zip(files) {
    const parts = []; const central = []; let offset = 0;
    const d = new Date(); const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1); const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const name = enc.encode(f.name); const data = typeof f.data === "string" ? enc.encode(f.data) : f.data; const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0)); let o = 0;
    for (const p of all) { out.set(p, o); o += p.length; }
    return out;
  }

  async function inflate(data) {
    if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot open compressed files. Save the file as CSV and try again.");
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([data]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /** Uint8Array → { name: Uint8Array } using the central directory. */
  async function unzip(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let e = b.length - 22; while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error("This is not a valid zip-based file.");
    const count = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true); const out = {};
    for (let i = 0; i < count; i++) {
      const method = v.getUint16(p + 10, true); const csize = v.getUint32(p + 20, true); const nlen = v.getUint16(p + 28, true); const xlen = v.getUint16(p + 30, true); const clen = v.getUint16(p + 32, true); const lho = v.getUint32(p + 42, true);
      const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nlen));
      const ln = v.getUint16(lho + 26, true); const lx = v.getUint16(lho + 28, true); const start = lho + 30 + ln + lx;
      const raw = b.subarray(start, start + csize);
      out[name] = method === 0 ? raw : method === 8 ? await inflate(raw) : null;
      p += 46 + nlen + xlen + clen;
    }
    return out;
  }

  const xmlEsc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  const colName = (i) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

  /** sheets: [{ name, rows: any[][] }] (first row is the header, bold). Numbers stay numbers. */
  function xlsx(sheets) {
    const files = [];
    files.push({ name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` });
    files.push({ name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` });
    files.push({ name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` });
    files.push({ name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` });
    files.push({ name: "xl/styles.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F3F6"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` });
    sheets.forEach((s, si) => {
      const widths = (s.rows[0] || []).map((_, c) => Math.min(60, Math.max(8, ...s.rows.slice(0, 200).map((r) => String(r[c] ?? "").length + 2))));
      const rows = s.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
        const ref = `${colName(ci)}${ri + 1}`; const st = ri === 0 ? ' s="1"' : "";
        if (typeof v === "number" && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
        return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
      }).join("")}</row>`).join("");
      files.push({ name: `xl/worksheets/sheet${si + 1}.xml`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${rows}</sheetData></worksheet>` });
    });
    return zip(files);
  }

  /** First worksheet of an .xlsx as rows of strings (browser only: uses DOMParser). */
  async function readXlsx(buf) {
    const files = await unzip(buf);
    const dec = (k) => (files[k] ? new TextDecoder().decode(files[k]) : "");
    const parse = (s) => new DOMParser().parseFromString(s, "application/xml");
    const shared = [];
    if (files["xl/sharedStrings.xml"]) parse(dec("xl/sharedStrings.xml")).querySelectorAll("si").forEach((si) => shared.push([...si.querySelectorAll("t")].map((t) => t.textContent).join("")));
    const sheetName = Object.keys(files).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
    if (!sheetName) throw new Error("No worksheet found in this workbook.");
    const doc = parse(dec(sheetName)); const rows = [];
    doc.querySelectorAll("sheetData > row").forEach((row) => {
      const r = [];
      row.querySelectorAll("c").forEach((c) => {
        const ref = c.getAttribute("r") || ""; const col = ref.replace(/\d+/g, "").split("").reduce((s, ch) => s * 26 + ch.charCodeAt(0) - 64, 0) - 1;
        const t = c.getAttribute("t"); let v = "";
        if (t === "s") v = shared[+(c.querySelector("v")?.textContent || 0)] ?? "";
        else if (t === "inlineStr") v = [...c.querySelectorAll("t")].map((x) => x.textContent).join("");
        else v = c.querySelector("v")?.textContent ?? "";
        r[col >= 0 ? col : r.length] = v;
      });
      rows.push(Array.from(r, (x) => x ?? ""));
    });
    return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  }

  DO.zip = { zip, unzip, xlsx, readXlsx, crc32 };
})(typeof window !== "undefined" ? window : globalThis);
