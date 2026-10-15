import { createClient } from "@supabase/supabase-js";

// Read-only client for public data. It never touches cookies, so pages that use it
// can be cached (ISR) instead of hitting the database on every visit.
export function createPublicClient() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

	if (!url || !key) {
		throw new Error("Missing Supabase environment variables.");
	}

	return createClient(url, key, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
			detectSessionInUrl: false,
		},
	});
}
