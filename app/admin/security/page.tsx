import { MfaSetup } from "@/components/admin/MfaSetup";
import { requireAdminMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SecurityPage() {
	await requireAdminMember();

	const supabase = await createClient();
	const { data: factors } = await supabase.auth.mfa.listFactors();
	const enrolled = (factors?.totp ?? []).length > 0;

	return (
		<main className="login-wrap">
			<div className="login-card form-card">
				<p className="eyebrow">ΑΣΦΑΛΕΙΑ</p>

				<h1>Επαλήθευση δύο βημάτων</h1>

				{enrolled ? (
					<>
						<p>Η επαλήθευση δύο βημάτων είναι ενεργή.</p>

						<a className="button" href="/admin">
							Πίσω στο admin
						</a>
					</>
				) : (
					<MfaSetup />
				)}
			</div>
		</main>
	);
}
