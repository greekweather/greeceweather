import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Tells the site header whether to show the "Διαχείριση" link. Only a convenience: every
// /admin page still enforces login + admin membership + 2FA on its own.
export async function GET() {
	const headers = { "Cache-Control": "private, no-store" };

	try {
		const supabase = await createClient();
		const { data, error } = await supabase.auth.getUser();

		if (error || !data.user) return NextResponse.json({ admin: false }, { headers });

		const { data: isMember } = await supabase.rpc("is_admin_member");

		return NextResponse.json({ admin: isMember === true }, { headers });
	} catch {
		return NextResponse.json({ admin: false }, { headers });
	}
}
