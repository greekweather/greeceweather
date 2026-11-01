import { createClient } from "@supabase/supabase-js";

// Client with the service role key: it bypasses row-level security and sees everything.
// Server-only, and only for jobs that no visitor can trigger directly (counting views,
// sending notifications, the nightly backup). Never import this into a client component.
export function createServiceClient() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !key) {
		throw new Error("Missing Supabase service role environment variables.");
	}

	return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
