import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Only allow same-site paths such as "/admin" or "/posts/x".
function safeNextPath(value: string | null): string {
	if (!value?.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
		return "/admin";
	}

	return value;
}

export async function GET(request: Request) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const next = safeNextPath(url.searchParams.get("next"));

	if (code) {
		const supabase = await createClient();
		const { error } = await supabase.auth.exchangeCodeForSession(code);

		if (error) {
			return NextResponse.redirect(new URL("/admin/login", url.origin));
		}
	}

	return NextResponse.redirect(new URL(next, url.origin));
}
