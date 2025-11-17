import { NextResponse } from 'next/server';
import { getSessionFromCookies } from '../../../../lib/session';
import { createUploadSignature, getCloudinaryCreds } from '../../../../lib/cloudinary';

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Нэвтэрнэ үү' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const folder = (body?.folder || 'neoncanvas/uploads').toString();
    const public_id = body?.public_id ? body.public_id.toString() : undefined;

    const { cloudName, apiKey } = getCloudinaryCreds();
    const { timestamp, signature } = createUploadSignature({ folder, public_id });

    return new NextResponse(JSON.stringify({
      ok: true,
      cloudName,
      apiKey,
      folder,
      timestamp,
      signature,
      public_id,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (err: any) {
    console.error('Cloudinary sign error:', err);
    return NextResponse.json({ ok: false, error: 'Cloudinary тохиргоо байхгүй эсвэл серверийн алдаа' }, { status: 500 });
  }
}
