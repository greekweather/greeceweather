import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

// How far the sign-in has got with the second factor. supabase.auth.mfa.
// getAuthenticatorAssuranceLevel() reads the user out of the cookie, which Supabase warns can
// be forged on the server. Here the level comes from the verified token (getClaims) and the
// factors from the user the Auth server just confirmed (getUser).
async function assuranceLevel(supabase: SupabaseClient, user: User) {
	const { data } = await supabase.auth.getClaims();
	const claims = data?.claims as { aal?: string } | undefined;
	const enrolled = (user.factors ?? []).some((factor) => factor.status === "verified");

	return {
		currentLevel: claims?.aal === "aal2" ? "aal2" : "aal1",
		nextLevel: enrolled ? "aal2" : "aal1",
	};
}

export async function getUser() {
	const supabase = await createClient();
	const { data, error } = await supabase.auth.getUser();
	if (error || !data.user) return null;
	return data.user;
}

// Signed in and listed in admin_users. Does NOT demand the second factor:
// used only by the 2FA setup page.
export async function requireAdminMember() {
	const supabase = await createClient();
	const { data: userData, error: userError } = await supabase.auth.getUser();
	if (userError || !userData.user) redirect("/admin/login");

	const { data: isMember, error } = await supabase.rpc("is_admin_member");
	if (error || !isMember) {
		// a signed-in account that is not an admin tried the admin area
		log.warn("admin.denied", {
			reason: error ? "membership check failed" : "not an admin",
			user: userData.user.id.slice(0, 8),
		});
		redirect("/admin/login?error=not-authorized");
	}

	return userData.user;
}

// Admin AND second factor verified in this session.
export async function requireAdmin() {
	const user = await requireAdminMember();

	const supabase = await createClient();
	const aal = await assuranceLevel(supabase, user);

	if (aal.currentLevel !== "aal2") {
		log.info("admin.second_factor_needed", { user: user.id.slice(0, 8), next: aal.nextLevel });
		redirect(aal.nextLevel === "aal2" ? "/admin/login?step=mfa" : "/admin/security");
	}

	return user;
}

// For route handlers, which cannot redirect: signed in, admin member and second factor done.
export async function isAdminSession() {
	const supabase = await createClient();
	const { data: userData, error } = await supabase.auth.getUser();

	if (error || !userData.user) return false;

	const { data: isMember } = await supabase.rpc("is_admin_member");

	if (isMember !== true) return false;

	return (await assuranceLevel(supabase, userData.user)).currentLevel === "aal2";
}
