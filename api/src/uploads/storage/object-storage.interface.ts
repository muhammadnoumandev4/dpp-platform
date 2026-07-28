export const OBJECT_STORAGE = 'OBJECT_STORAGE';

export interface PutObjectParams {
  buffer: Buffer;
  key: string;
  contentType: string;
}

/**
 * Storage is behind this interface — swapping the local-disk adapter for S3
 * or R2 means writing one new class and changing the provider binding in
 * UploadsModule; nothing above this layer (service, controller, callers)
 * changes. All methods are async so a network-backed adapter is a drop-in
 * replacement, not a rewrite.
 */
export interface ObjectStorage {
  put(params: PutObjectParams): Promise<void>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
  /** Read object bytes for gated serving. */
  read(key: string): Promise<Buffer>;
}
