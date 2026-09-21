import sharp from 'sharp';
import { supabase } from '../../../lib/supabase';
import { avatarSourceKey, avatarVersion, decodeAvatarData } from '../../../lib/avatars';
import { getCached, getOrLoadCached } from '../../../lib/serverCache';

export const runtime = 'nodejs';
type AvatarImage = { bytes?: Buffer; location?: string; etag: string };
const PLACEHOLDER = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#334155"/><circle cx="48" cy="35" r="16" fill="#94a3b8"/><path d="M18 85c0-22 12-32 30-32s30 10 30 32" fill="#94a3b8"/></svg>');

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email') || '';
  const version = searchParams.get('v') || '';
  if (!email || email.length > 320 || (version && !/^[a-f0-9]{16}$/.test(version))) {
    return new Response(null, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const thumbnail = await getOrLoadCached<AvatarImage | null>(`avatar:${JSON.stringify([email, version])}`, async () => {
      let source = version ? getCached<string>(avatarSourceKey(email, version), 60_000) : null;
      if (!source) {
        const { data, error } = await supabase.from('users').select('avatar_url')
          .eq('email', email).abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
        if (error) throw error;
        source = data?.avatar_url;
      }
      if (version && (!source || avatarVersion(source) !== version)) return null;
      if (source && /^https?:\/\//i.test(source)) {
        return { location: source, etag: avatarVersion(source) };
      }
      const bytes = source ? decodeAvatarData(source) : null;
      const output = await sharp(bytes || PLACEHOLDER, { limitInputPixels: 16_777_216 })
        .rotate().resize(96, 96, { fit: 'cover', withoutEnlargement: true })
        .webp({ quality: 76 }).toBuffer();
      return { bytes: output, etag: source && bytes ? avatarVersion(source) : 'default' };
    }, version ? 300_000 : 60_000);

    if (!thumbnail) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const etag = `"${thumbnail.etag}-96-webp"`;
    const headers = {
      'Content-Type': 'image/webp',
      'Cache-Control': version ? 'public, max-age=31536000, immutable' : 'public, max-age=60, stale-while-revalidate=120',
      'ETag': etag,
      'X-Content-Type-Options': 'nosniff',
    };
    if (thumbnail.location) {
      return new Response(null, { status: 307, headers: { 'Location': thumbnail.location, 'Cache-Control': headers['Cache-Control'] } });
    }
    if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
    return new Response(new Uint8Array(thumbnail.bytes!), { headers });
  } catch (error) {
    console.error('Error loading avatar:', error);
    return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
