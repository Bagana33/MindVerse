import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getSessionFromCookies } from "../../../../lib/session";
import { getCloudinaryCreds } from "../../../../lib/cloudinary";

type ParsedCloudinary = {
  resourceType: "image" | "video" | "raw" | "auto";
  deliveryType: string;
  publicId: string;
  attachmentUrl: string;
};

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseCloudinaryUrl(url: string): ParsedCloudinary | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("res.cloudinary.com")) return null;

    const parts = u.pathname.split("/").filter(Boolean);
    // /{cloud}/{resource_type}/{type}/.../{version}/{public_id}
    if (parts.length < 5) return null;
    const [cloudName, resourceType, deliveryType] = parts;
    if (!cloudName || !resourceType || !deliveryType) return null;
    if (!["image", "video", "raw", "auto"].includes(resourceType)) return null;

    const versionIndex = parts.findIndex((part, idx) => idx >= 3 && /^v\d+$/.test(part));
    if (versionIndex < 0) return null;
    if (versionIndex + 1 >= parts.length) return null;

    const existingTransforms = parts.slice(3, versionIndex);
    const hasAttachment = existingTransforms.some((segment) => segment.includes("fl_attachment"));
    const transforms = hasAttachment
      ? existingTransforms
      : existingTransforms.length > 0
        ? [`${existingTransforms[0]},fl_attachment`, ...existingTransforms.slice(1)]
        : ["fl_attachment"];

    const attachmentParts = [...parts.slice(0, 3), ...transforms, ...parts.slice(versionIndex)];
    const publicId = decodeURIComponent(parts.slice(versionIndex + 1).join("/"));
    if (!publicId) return null;

    u.pathname = `/${attachmentParts.join("/")}`;
    return {
      resourceType: resourceType as ParsedCloudinary["resourceType"],
      deliveryType,
      publicId,
      attachmentUrl: u.toString(),
    };
  } catch (e) {
    console.error("Failed to parse Cloudinary URL:", e);
    return null;
  }
}

function sanitizeAttachmentName(name: string | null): string | undefined {
  if (!name) return undefined;
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/[\\/:*?"<>|]/g, "_").slice(0, 200);
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ ok: false, error: "Файлын URL байхгүй байна" }, { status: 400 });
  }

  if (!isSafeHttpUrl(url)) {
    return NextResponse.json({ ok: false, error: "Файлын URL буруу байна" }, { status: 400 });
  }

  const attachmentName = sanitizeAttachmentName(req.nextUrl.searchParams.get("name"));

  // If it's not a Cloudinary URL, pass through.
  const parsedCloudinary = parseCloudinaryUrl(url);
  if (!parsedCloudinary) {
    return NextResponse.redirect(url);
  }

  try {
    // Required for private resources (ACL/authenticated assets)
    getCloudinaryCreds();

    const signedDownloadUrl = cloudinary.utils.private_download_url(
      parsedCloudinary.publicId,
      undefined,
      {
        resource_type: parsedCloudinary.resourceType,
        type: parsedCloudinary.deliveryType,
        // Cloudinary supports passing attachment filename string, but typings only allow boolean.
        attachment: (attachmentName || true) as any,
      }
    );

    return NextResponse.redirect(signedDownloadUrl);
  } catch (err) {
    console.error("Lesson file download sign error, using unsigned fallback:", err);
    return NextResponse.redirect(parsedCloudinary.attachmentUrl);
  }
}
