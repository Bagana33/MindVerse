import { NextResponse } from "next/server";
import { getUser } from "../../../lib/users";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ ok: false, error: "Email шаардлагатай" }, { status: 400 });
  }

  const user = await getUser(email);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, user });
}
