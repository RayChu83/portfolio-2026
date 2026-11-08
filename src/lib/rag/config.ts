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
