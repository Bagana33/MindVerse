import { createHash } from 'node:crypto';
import { setCached } from './serverCache';

const RASTER_DATA_URI = /^data:image\/(png|jpe?g|webp|gif|avif);base64,([a-z0-9+/=\r\n]+)$/i;
const MAX_AVATAR_DATA_LENGTH = 12 * 1024 * 1024;

export function decodeAvatarData(source: string): Buffer | null {
  if (source.length > MAX_AVATAR_DATA_LENGTH) return null;
  const match = RASTER_DATA_URI.exec(source);
  return match ? Buffer.from(match[2], 'base64') : null;
}

export function avatarVersion(source: string): string {
  return createHash('sha256').update(source).digest('hex').slice(0, 16);
}

export function avatarSourceKey(email: string, version: string): string {
  return `avatar_source:${JSON.stringify([email, version])}`;
}

/** Keep legacy inline avatars out of list JSON without changing stored originals. */
export function getPublicAvatarUrl(email: string, source?: string): string | undefined {
  // List queries intentionally omit the large avatar column. Load only visible images.
  if (source === undefined) return `/api/avatars?email=${encodeURIComponent(email)}`;
  if (!source?.startsWith('data:')) return source;
  if (source.length > MAX_AVATAR_DATA_LENGTH || !RASTER_DATA_URI.test(source)) return undefined;
  const version = avatarVersion(source);
  // The list already fetched this image. Reuse it for the first thumbnail request.
  setCached(avatarSourceKey(email, version), source, 60_000);
  return `/api/avatars?email=${encodeURIComponent(email)}&v=${version}`;
}
