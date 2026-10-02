import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parse } from "csv-parse/sync";
import { Workbook } from "exceljs";
import { fromBuffer, Entry } from "yauzl";
import { CATALOG_LIMITS, CatalogFormat, CatalogPreview, CatalogProduct, CatalogRow, productKey } from "./catalog-types";

const headers: Record<string, "name" | "description" | "category" | "brand"> = {
  name: "name", "product name": "name", "ชื่อสินค้า": "name", description: "description", "รายละเอียด": "description",
  category: "category", "หมวดหมู่": "category", brand: "brand", "แบรนด์": "brand",
};
const headerField = (value: string) => {
  const key = value.trim().toLowerCase();
  return Object.hasOwn(headers, key) ? headers[key] : undefined;
};
export function previewTable(table: string[][]): CatalogPreview {
  if (table.length < 2) throw new Error("No product rows found. Use the provided catalog template.");
  if (table.length > CATALOG_LIMITS.rows + 1 || table.some((row) => row.length > CATALOG_LIMITS.columns)) throw new Error("Catalog exceeds 500 rows or 12 columns.");
  const mapped = table[0].map(headerField);
  if (!mapped.includes("name")) throw new Error("A name / ชื่อสินค้า column is required.");
  const known = mapped.filter((field): field is keyof CatalogProduct => field !== undefined);
  if (new Set(known).size !== known.length) throw new Error("Duplicate product columns are not supported.");
  const warnings = table[0].flatMap((column, i) => mapped[i] ? [] : [`Column '${column.slice(0, 60)}' is ignored. Supported fields: name, description, category, brand.`]);
  const seen = new Set<string>();
  const rows: CatalogRow[] = table.slice(1).map((values, index) => {
    const product = { name: "", description: null as string | null, category: null as string | null, brand: null as string | null };
    const errors: string[] = [];
    if (values.length !== mapped.length) errors.push("Column count differs from the header.");
    values.forEach((value, i) => { const field = mapped[i]; if (field === "name") product.name = value.trim(); else if (field) product[field] = value.trim() || null; });
    if (!product.name) errors.push("Product name is required.");
    for (const [field, value] of Object.entries(product)) {
      if (value && value.length > (field === "description" ? 5000 : 255)) errors.push(`${field} exceeds its length limit.`);
      if (value && /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) errors.push(`${field} contains control characters.`);
    }
    const key = productKey(product.name);
    if (seen.has(key)) errors.push("Duplicate normalized product name in this file.");
    if (!errors.length) seen.add(key);
    return { row: index + 2, product, errors, warnings: [] };
  });
  return { rows, fields: known, warnings, validCount: rows.filter((row) => row.errors.length === 0).length };
}

// Inspect ZIP metadata and bounded decompressed XML before handing XLSX to ExcelJS.
export async function inspectXlsx(data: Buffer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    fromBuffer(data, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) { reject(new Error("Invalid XLSX archive.")); return; }
      let count = 0, expanded = 0, contentTypes = false, workbook = false;
      const fail = (message: string) => { zip.close(); reject(new Error(message)); };
      zip.on("error", () => fail("Invalid XLSX archive."));
      zip.on("end", () => contentTypes && workbook ? resolve() : fail("Not an XLSX workbook."));
      zip.on("entry", (entry: Entry) => {
        expanded += entry.uncompressedSize;
        if (++count > 300 || expanded > 32 * 1024 * 1024 || entry.uncompressedSize > 8 * 1024 * 1024 ||
          (entry.uncompressedSize > 1024 * 1024 && entry.uncompressedSize > entry.compressedSize * 200)) { fail("XLSX expansion limit exceeded."); return; }
        if ((entry.generalPurposeBitFlag & 1) || /(?:vbaProject|externalLinks|embeddings|activeX)/i.test(entry.fileName) || /(?:^\/|\\|\.\.)/.test(entry.fileName)) { fail("Encrypted, macro-enabled, embedded or external-link workbooks are unsupported."); return; }
        contentTypes ||= entry.fileName === "[Content_Types].xml";
        workbook ||= entry.fileName === "xl/workbook.xml";
        if (!entry.fileName.endsWith(".xml")) { zip.readEntry(); return; }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) { fail("Unreadable XLSX XML."); return; }
          const chunks: Buffer[] = []; let bytes = 0;
          stream.on("error", () => fail("Invalid compressed XLSX XML."));
          stream.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 8 * 1024 * 1024) { stream.destroy(); fail("XLSX XML limit exceeded."); } else chunks.push(chunk); });
          stream.on("end", () => {
            const xml = Buffer.concat(chunks).toString("utf8");
            if (/<!DOCTYPE|<!ENTITY|macroEnabled/i.test(xml)) { fail("Unsafe XLSX content is unsupported."); return; }
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}

async function xlsx(data: Buffer): Promise<CatalogPreview> {
  await inspectXlsx(data);
  const workbook = new Workbook();
  await workbook.xlsx.load(data as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheets = workbook.worksheets.filter((sheet) => sheet.actualRowCount > 0);
  if (sheets.length !== 1 || sheets[0].state !== "visible") throw new Error("Use one visible worksheet per catalog.");
  const sheet = sheets[0];
  if (sheet.rowCount > CATALOG_LIMITS.rows + 1 || sheet.columnCount > CATALOG_LIMITS.columns) throw new Error("Catalog exceeds 500 rows or 12 columns.");
  const table: string[][] = [];
  for (let number = 1; number <= sheet.rowCount; number++) {
    const row: string[] = [];
    for (let column = 1; column <= sheet.columnCount; column++) {
      const cell = sheet.getRow(number).getCell(column);
      if (cell.type === 6 || cell.type === 5 || cell.type === 10) throw new Error("Formula, hyperlink and error cells are unsupported. Paste values into the template.");
      row.push(cell.text);
    }
    if (row.some((value) => value.trim())) table.push(row);
  }
  return previewTable(table);
}

async function pdf(data: Buffer): Promise<CatalogPreview> {
  // Native ESM import preserved in this CommonJS service. Never evaluate uploaded code.
  const loadPdf = new Function("return import('pdfjs-dist/legacy/build/pdf.mjs')") as () => Promise<typeof import("pdfjs-dist/types/src/pdf")>;
  const { getDocument } = await loadPdf();
  const packageRoot = dirname(require.resolve("pdfjs-dist/package.json"));
  const task = getDocument({ data: new Uint8Array(data), useWasm: false, useSystemFonts: false, disableFontFace: true, enableXfa: false, useWorkerFetch: false,
    standardFontDataUrl: join(packageRoot, "standard_fonts").replace(/\\/g, "/") + "/", cMapUrl: join(packageRoot, "cmaps").replace(/\\/g, "/") + "/",
    maxImageSize: 1000000, stopAtErrors: true });
  try {
    const document = await task.promise;
    if (await document.getPermissions() !== null) throw new Error("Encrypted PDFs are unsupported.");
    if (document.numPages > CATALOG_LIMITS.pages) throw new Error("PDF exceeds the 20-page limit.");
    if (await document.hasJSActions() || await document.getAttachments()) throw new Error("PDF scripts and attachments are unsupported.");
    const lines: string[] = []; let characters = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      if (content.items.length > 10000) throw new Error("PDF text resource limit exceeded.");
      const textItems = content.items.filter((item): item is Extract<typeof item, { str: string }> => "str" in item);
      const groups = new Map<number, { x: number; text: string }[]>();
      for (const item of textItems) {
        characters += item.str.length;
        if (characters > 100000) throw new Error("PDF text limit exceeded.");
        const y = Math.round(item.transform[5] / 3) * 3;
        const group = groups.get(y) ?? []; group.push({ x: item.transform[4], text: item.str }); groups.set(y, group);
      }
      for (const [, group] of [...groups].sort(([a], [b]) => b - a)) lines.push(group.sort((a, b) => a.x - b.x).map((item) => item.text).join(" "));
      page.cleanup();
    }
    if (!characters) throw new Error("Image-only/scanned PDF: OCR is not supported. Use CSV or XLSX instead.");
    // Only an explicit pipe-delimited table with a recognized header is structured data.
    const start = lines.findIndex((line) => line.includes("|") && line.split("|").some((value) => headerField(value) === "name"));
    if (start < 0) throw new Error("Unstructured PDF: no explicit name | description | category | brand table found. Use CSV/XLSX; no products were inferred.");
    const table: string[][] = [];
    for (const line of lines.slice(start)) {
      if (!line.includes("|")) { if (table.length > 1) break; continue; }
      const values = line.split("|").map((value) => value.trim());
      if (table.length && values.length === table[0].length && values.every((value, index) => value.toLowerCase() === table[0][index].toLowerCase())) continue;
      table.push(values);
    }
    const preview = previewTable(table);
    preview.warnings.push("PDF extraction requires review. Only the explicit pipe-delimited table was read; other text was ignored.");
    return preview;
  } catch (error) {
    if (error instanceof Error && /password|encrypt/i.test(error.message)) throw new Error("Encrypted PDFs are unsupported.");
    throw error;
  } finally { await task.destroy(); }
}

export async function parseCatalog(path: string, format: CatalogFormat): Promise<CatalogPreview> {
  const data = await readFile(path);
  if (data.length > CATALOG_LIMITS.bytes) throw new Error("File exceeds 5 MB.");
  if (format === "xlsx") return xlsx(data);
  if (format === "pdf") return pdf(data);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  if (text.includes("\0")) throw new Error("CSV must be UTF-8 text.");
  return previewTable(parse(text, { bom: true, skip_empty_lines: true, max_record_size: 24000, relax_column_count: true, to: CATALOG_LIMITS.rows + 2 }) as string[][]);
}
