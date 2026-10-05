import { createHash } from "node:crypto";

import type {
  AiKnowledgeDocument,
  VectorDocumentForAi,
} from "../../types/ai-contract.types";

export interface ChunkingOptions {
  maxCharacters?: number;
  overlapCharacters?: number;
}

const defaultMaxCharacters = 1_200;
const defaultOverlapCharacters = 160;

export function chunkKnowledgeDocuments(
  documents: AiKnowledgeDocument[],
  options: ChunkingOptions = {},
): VectorDocumentForAi[] {
  const maxCharacters = normalizePositiveInteger(
    options.maxCharacters,
    defaultMaxCharacters,
  );
  const overlapCharacters = Math.min(
    normalizePositiveInteger(
      options.overlapCharacters,
      defaultOverlapCharacters,
    ),
    Math.floor(maxCharacters / 3),
  );

  return documents.flatMap((document) =>
    chunkDocument(document, maxCharacters, overlapCharacters),
  );
}

function chunkDocument(
  document: AiKnowledgeDocument,
  maxCharacters: number,
  overlapCharacters: number,
): VectorDocumentForAi[] {
  const normalizedContent = normalizeText(document.content);

  if (!normalizedContent) {
    return [];
  }

  const units = splitIntoUnits(normalizedContent, maxCharacters);
  const baseChunks = combineUnits(units, maxCharacters);
  const chunks = baseChunks.map((chunk, index) => {
    if (index === 0 || overlapCharacters === 0) {
      return chunk;
    }

    const overlap = takeBoundaryOverlap(
      baseChunks[index - 1],
      overlapCharacters,
    );

    return overlap ? `${overlap}\n${chunk}` : chunk;
  });

  return chunks.map((chunkText, chunkIndex) => {
    const chunkKey = [
      document.merchant_id,
      document.source_type,
      document.source_id,
      chunkIndex,
    ].join(":");
    const contentHash = sha256(chunkText);

    return {
      id: deterministicUuid(chunkKey),
      merchant_id: document.merchant_id,
      source_type: document.source_type,
      source_id: document.source_id,
      chunk_text: chunkText,
      embedding: null,
      metadata: {
        ...document.metadata,
        title: document.title,
        chunk_index: chunkIndex,
        chunk_count: chunks.length,
        chunk_key: chunkKey,
        content_hash: contentHash,
        managed_by: "chatto-live-chunker",
        max_characters: maxCharacters,
        overlap_characters: overlapCharacters,
      },
      status: "active",
    };
  });
}

function splitIntoUnits(text: string, maxCharacters: number): string[] {
  const semanticUnits = text
    .split(/(?<=[.!?。！？])\s+|\n{2,}/u)
    .map((unit) => unit.trim())
    .filter(Boolean);

  return semanticUnits.flatMap((unit) => {
    if (unit.length <= maxCharacters) {
      return [unit];
    }

    const slices: string[] = [];
    let cursor = 0;

    while (cursor < unit.length) {
      const tentativeEnd = Math.min(cursor + maxCharacters, unit.length);
      const end = findNaturalBreak(unit, cursor, tentativeEnd);
      const slice = unit.slice(cursor, end).trim();

      if (slice) {
        slices.push(slice);
      }

      cursor = end > cursor ? end : tentativeEnd;
    }

    return slices;
  });
}

function combineUnits(units: string[], maxCharacters: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const unit of units) {
    const candidate = current ? `${current} ${unit}` : unit;

    if (current && candidate.length > maxCharacters) {
      chunks.push(current);
      current = unit;
    } else {
      current = candidate;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function findNaturalBreak(
  text: string,
  start: number,
  tentativeEnd: number,
): number {
  if (tentativeEnd >= text.length) {
    return text.length;
  }

  const minimumBreak = start + Math.floor((tentativeEnd - start) * 0.65);

  for (let index = tentativeEnd; index >= minimumBreak; index -= 1) {
    if (/\s/u.test(text[index] ?? "")) {
      return index + 1;
    }
  }

  return tentativeEnd;
}

function takeBoundaryOverlap(text: string, maxCharacters: number): string {
  if (text.length <= maxCharacters) {
    return text;
  }

  const start = text.length - maxCharacters;
  const boundary = text.indexOf(" ", start);

  return text.slice(boundary >= 0 ? boundary + 1 : start).trim();
}

function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function deterministicUuid(value: string): string {
  const hex = sha256(value).slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const joined = hex.join("");

  return [
    joined.slice(0, 8),
    joined.slice(8, 12),
    joined.slice(12, 16),
    joined.slice(16, 20),
    joined.slice(20),
  ].join("-");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}
