import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
	if (error || !isMember) redirect("/admin/login?error=not-authorized");

	return userData.user;
}

// Admin AND second factor verified in this session.
export async function requireAdmin() {
	const user = await requireAdminMember();

	const supabase = await createClient();
	const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

	if (aal?.currentLevel !== "aal2") {
		redirect(aal?.nextLevel === "aal2" ? "/admin/login?step=mfa" : "/admin/security");
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

	const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

	return aal?.currentLevel === "aal2";
}
