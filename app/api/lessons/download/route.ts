import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getSessionFromCookies } from "../../../../lib/session";
import { getCloudinaryCreds } from "../../../../lib/cloudinary";

type ParsedCloudinary = {
  resourceType: "image" | "video" | "raw" | "auto";
  publicId: string;
};

function parseCloudinaryUrl(url: string): ParsedCloudinary | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("res.cloudinary.com")) return null;

    const parts = u.pathname.split("/").filter(Boolean);
    // Expected: /{cloud}/raw/upload/v12345/path/to/file.ext
    if (parts.length < 5) return null;

    const [cloud, resourceType, deliveryType, version, ...rest] = parts;
    if (!cloud || deliveryType !== "upload" || !version?.startsWith("v") || rest.length === 0) {
      return null;
    }

    if (!["image", "video", "raw", "auto"].includes(resourceType)) return null;

    const publicId = decodeURIComponent(rest.join("/"));
    return { resourceType: resourceType as ParsedCloudinary["resourceType"], publicId };
  } catch (e) {
    console.error("Failed to parse Cloudinary URL:", e);
    return null;
  }
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

  // If it's not a Cloudinary URL, just pass it through
  const parsed = parseCloudinaryUrl(url);
  if (!parsed) {
    return NextResponse.redirect(url);
  }

  try {
    // Ensure creds are present (throws if missing)
    getCloudinaryCreds();

    const downloadUrl = cloudinary.utils.private_download_url(
      parsed.publicId,
      undefined,
      {
        resource_type: parsed.resourceType,
        type: "upload",
      }
    );

    return NextResponse.redirect(downloadUrl);
  } catch (err) {
    console.error("Lesson file download sign error:", err);
    // Fallback to original URL (may still fail but better than blocking)
    return NextResponse.redirect(url);
  }
}
