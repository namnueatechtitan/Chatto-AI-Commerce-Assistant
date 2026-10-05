const stopWords = new Set("a an and are as at be by for from how i in is it of on or the this to what with your".split(" "));
const segmenter = new Intl.Segmenter("th", { granularity: "word" });

export function normalizeSearchText(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[\u200B-\u200D\uFEFF]/gu, "").trim();
}

/** ICU word boundaries handle Thai without spaces; compound SKU tokens remain exact. */
export function tokenize(text: string): string[] {
  const normalized = normalizeSearchText(text);
  const words = [...segmenter.segment(normalized)]
    .filter(part => part.isWordLike).map(part => part.segment)
    .filter(word => !stopWords.has(word));
  return [...words, ...(normalized.match(/[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)+/gu) ?? [])];
}

export interface Bm25Hit { index: number; score: number; coverage: number }

/** Okapi BM25, k1=1.2 and b=.75. Raw scores are rankings, not probabilities. */
export class Bm25Index {
  private readonly frequencies: Map<string, number>[];
  private readonly lengths: number[];
  private readonly documentFrequency = new Map<string, number>();
  private readonly averageLength: number;

  constructor(texts: string[]) {
    this.frequencies = texts.map(text => {
      const frequencies = new Map<string, number>();
      for (const term of tokenize(text)) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
      for (const term of frequencies.keys()) this.documentFrequency.set(term, (this.documentFrequency.get(term) ?? 0) + 1);
      return frequencies;
    });
    this.lengths = this.frequencies.map(frequencies => [...frequencies.values()].reduce((sum, count) => sum + count, 0));
    this.averageLength = this.lengths.reduce((sum, length) => sum + length, 0) / Math.max(texts.length, 1) || 1;
  }

  search(query: string): Bm25Hit[] {
    const terms = [...new Set(tokenize(query))];
    if (!terms.length) return [];
    const hits: Bm25Hit[] = [];
    this.frequencies.forEach((frequencies, index) => {
      let score = 0; let matches = 0;
      for (const term of terms) {
        const frequency = frequencies.get(term) ?? 0;
        if (!frequency) continue;
        matches++;
        const df = this.documentFrequency.get(term) ?? 0;
        const idf = Math.log(1 + (this.frequencies.length - df + 0.5) / (df + 0.5));
        const lengthNormalization = 1 - 0.75 + 0.75 * this.lengths[index] / this.averageLength;
        score += idf * (frequency * 2.2) / (frequency + 1.2 * lengthNormalization);
      }
      if (score > 0) hits.push({ index, score, coverage: matches / terms.length });
    });
    return hits.sort((left, right) => right.score - left.score || left.index - right.index);
  }
}
