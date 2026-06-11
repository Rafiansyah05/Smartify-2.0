import { NextRequest, NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabase/server";
import { getUserFromToken } from "@/lib/auth/auth-service";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: quizzes, error } = await supabase
      .from("kuis")
      .select("*")
      .eq("guru_id", user.user_id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ quizzes });
  } catch (error: any) {
    console.error("Fetch quizzes error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
