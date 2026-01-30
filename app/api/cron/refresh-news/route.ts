import { NextResponse } from "next/server";

// Vercel Cron Job - 24 цаг тутамд ажиллана
export async function GET(req: Request) {
  try {
    // Authorization check - Vercel Cron эсвэл local development.
    // In Vercel: set CRON_SECRET with no leading/trailing spaces (else "whitespace in HTTP header" error).
    const secret = (process.env.CRON_SECRET || "").trim();
    const authHeader = (req.headers.get("authorization") || "").trim();
    if (
      process.env.NODE_ENV === "production" &&
      (!secret || authHeader !== `Bearer ${secret}`)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Auto-refresh API дуудах
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/posts/auto-refresh`, {
      method: "POST",
    });

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: "Cron job амжилттай",
      data,
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
