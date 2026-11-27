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
 *
 * Cost pre-filter only, not a scope boundary: on-topic and off-topic scores sit ~0.03 apart,
 * so scope is enforced by the system prompt.
 */
export const MIN_SCORE = 0.6;
export const TOP_K = 5;

/** Shared so the composer's `maxLength` and the route's validation cannot drift. */
export const MAX_QUESTION_LENGTH = 500;

/** Returned verbatim for no retrieval match and for any refused request, so a refusal is machine-checkable. */
export const REFUSAL_MESSAGE = "I'm not sure about that. Try asking a different question.";

/** One earlier question and its answer. Sent by the client, so the server treats it as untrusted. */
export type Exchange = { question: string; answer: string };

export const MAX_HISTORY_TURNS = 4;
export const MAX_HISTORY_ANSWER_LENGTH = 1000;
/** Cost backstop on the whole history, applied after the turn cap. Fits two maximum-size exchanges. */
export const MAX_HISTORY_CHARS = 3000;
