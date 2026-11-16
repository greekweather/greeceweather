import { createClient } from "@supabase/supabase-js";
import { requireEnv, SUPABASE_KEY_SHAPE } from "@/lib/env";

// Client with the service role key: it bypasses row-level security and sees everything.
// Server-only, and only for jobs that no visitor can trigger directly (counting views,
// sending notifications, the nightly backup). Never import this into a client component.
export function createServiceClient() {
	// each check throws an EnvError that names the variable and the problem, never its value
	const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
	const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY", { shape: SUPABASE_KEY_SHAPE });

	return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
