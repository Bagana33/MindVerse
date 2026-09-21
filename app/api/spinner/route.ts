import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "../../../lib/session";
import { supabase } from "../../../lib/supabase";
import { getOrLoadCached, invalidateServerCache } from "../../../lib/serverCache";

// The empty state is real; unavailable storage is an error, never invented choices.
export async function GET(req: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' };
  try {
    const session = await getSessionFromCookies();
    const result = await getOrLoadCached(`spinner:options:${session?.email || 'public'}`, async () => {
      const signal = AbortSignal.timeout(10000);
      const { data, error } = await supabase.from('spinner_options').select('option_text, added_by')
        .order('created_at', { ascending: true }).abortSignal(signal);
      if (error) throw error;
      return { ok: true, options: (data || []).map(row => row.option_text),
        userOptionCount: session ? (data || []).filter(row => row.added_by === session.email).length : 0 };
    }, 10000);
    return NextResponse.json(result, { headers });
  } catch (error) {
    console.error('Spinner read failed:', error);
    return NextResponse.json({ ok: false, error: 'Сонголтуудыг ачаалж чадсангүй. Дахин оролдоно уу.' }, { status: 503, headers });
  }
}

// POST: Add a new spinner option
export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { option } = body;

    if (typeof option !== "string" || !option.trim() || option.trim().length > 100) {
      return NextResponse.json({ ok: false, error: "Сонголт 1–100 тэмдэгттэй байна." }, { status: 400 });
    }

    // Check how many options this user has already added
    const { count: userOptionCount } = await supabase
      .from('spinner_options')
      .select('*', { count: 'exact', head: true })
      .eq('added_by', session.email);

    if (userOptionCount && userOptionCount >= 2) {
      return NextResponse.json({
        ok: false,
        error: "Та зөвхөн 2 сонголт нэмж болно"
      }, { status: 400 });
    }

    // Check if option already exists
    const { data: existing } = await supabase
      .from('spinner_options')
      .select('*')
      .eq('option_text', option.trim())
      .single();

    if (existing) {
      return NextResponse.json({ ok: false, error: "Энэ сонголт аль хэдийн байна" }, { status: 400 });
    }

    // Insert new option
    const { data, error } = await supabase
      .from('spinner_options')
      .insert([{
        option_text: option.trim(),
        added_by: session.email,
      }])
      .select()
      .single();

    if (error) {
      // If table doesn't exist, return error with helpful message
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({
          ok: false,
          error: "Сонголт хадгалах үйлчилгээ түр боломжгүй байна. Багшдаа мэдэгдэнэ үү."
        }, { status: 500 });
      }
      console.error("Error adding spinner option:", error);
      return NextResponse.json({ ok: false, error: "Нэмэхэд алдаа гарлаа" }, { status: 500 });
    }

    // Get all options
    const { data: allOptions } = await supabase
      .from('spinner_options')
      .select('*')
      .order('created_at', { ascending: true });

    const options = (allOptions || []).map(row => row.option_text);

    // Get updated user option count
    const { count: updatedUserOptionCount } = await supabase
      .from('spinner_options')
      .select('*', { count: 'exact', head: true })
      .eq('added_by', session.email);

    invalidateServerCache('spinner');

    return NextResponse.json({
      ok: true,
      options,
      userOptionCount: updatedUserOptionCount || 0
    });
  } catch (err: any) {
    console.error("Add spinner option error:", err);
    return NextResponse.json({ ok: false, error: "Серверийн алдаа" }, { status: 500 });
  }
}

// DELETE: Remove a spinner option (only teachers)
export async function DELETE(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Нэвтэрнэ үү" }, { status: 401 });
  }

  // Only teachers can delete options
  if (session.role !== "teacher") {
    return NextResponse.json({ ok: false, error: "Зөвхөн багш устгах эрхтэй" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { option } = body;

    if (!option) {
      return NextResponse.json({ ok: false, error: "Сонголт заавал байх ёстой" }, { status: 400 });
    }

    // Check current count
    const { count } = await supabase
      .from('spinner_options')
      .select('*', { count: 'exact', head: true });

    if (count && count <= 2) {
      return NextResponse.json({ ok: false, error: "Хамгийн багадаа 2 сонголт байх ёстой" }, { status: 400 });
    }

    // Delete option
    const { error } = await supabase
      .from('spinner_options')
      .delete()
      .eq('option_text', option);

    if (error) {
      console.error("Error deleting spinner option:", error);
      return NextResponse.json({ ok: false, error: "Устгахад алдаа гарлаа" }, { status: 500 });
    }

    // Get all remaining options
    const { data: allOptions } = await supabase
      .from('spinner_options')
      .select('*')
      .order('created_at', { ascending: true });

    const options = (allOptions || []).map(row => row.option_text);
    invalidateServerCache('spinner');
    const { count: userOptionCount } = await supabase.from('spinner_options')
      .select('*', { count: 'exact', head: true }).eq('added_by', session.email);
    return NextResponse.json({ ok: true, options, userOptionCount: userOptionCount || 0 });
  } catch (err: any) {
    console.error("Delete spinner option error:", err);
    return NextResponse.json({ ok: false, error: "Серверийн алдаа" }, { status: 500 });
  }
}

