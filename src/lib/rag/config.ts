/** Shared by the offline indexer and the query path, which must embed with the same model. */
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSION = 1536;

/** Metadata stored with every vector in the Upstash index. */
export type ChunkMetadata = {
  source: string;
  title: string;
  heading: string;
  chunkIndex: number;
  text: string;
};

/**
 * Floor for a retrieved chunk to count as relevant. Upstash reports cosine on a 0-1 scale,
 * so unrelated text still scores ~0.5. Calibrated on the 8-vector corpus: in-scope questions
 * topped out at >=0.62, off-topic ones at <=0.59. Recalibrate when the corpus grows.
 */
export const MIN_SCORE = 0.6;
export const TOP_K = 5;

/** Shared so the composer's `maxLength` and the route's validation cannot drift. */
export const MAX_QUESTION_LENGTH = 500;
