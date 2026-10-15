"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
	const router = useRouter();
	const search = useSearchParams();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [code, setCode] = useState("");
	const [step, setStep] = useState<"password" | "code">(
		search.get("step") === "mfa" ? "code" : "password",
	);

	const [message, setMessage] = useState(
		search.get("error") === "not-authorized"
			? "Ο λογαριασμός συνδέθηκε, αλλά δεν έχει δικαίωμα διαχείρισης."
			: "",
	);

	const [loading, setLoading] = useState(false);

	async function submitPassword(e: React.FormEvent) {
		e.preventDefault();

		setLoading(true);
		setMessage("");

		const supabase = createClient();

		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (error) {
			setMessage("Η σύνδεση απέτυχε. Έλεγξε email και κωδικό.");
			setLoading(false);
			return;
		}

		const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

		if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
			setStep("code");
			setLoading(false);
			return;
		}

		router.replace("/admin");
		router.refresh();
	}

	async function submitCode(e: React.FormEvent) {
		e.preventDefault();

		setLoading(true);
		setMessage("");

		const supabase = createClient();

		const { data: factors } = await supabase.auth.mfa.listFactors();
		const factor = factors?.totp?.[0];

		if (!factor) {
			setMessage("Δεν βρέθηκε ρυθμισμένη επαλήθευση. Συνδέσου ξανά.");
			setStep("password");
			setLoading(false);
			return;
		}

		const { error } = await supabase.auth.mfa.challengeAndVerify({
			factorId: factor.id,
			code: code.trim(),
		});

		if (error) {
			setMessage("Ο κωδικός δεν είναι σωστός. Δοκίμασε ξανά.");
			setLoading(false);
			return;
		}

		router.replace("/admin");
		router.refresh();
	}

	return (
		<main className="login-wrap">
			<div className="login-card form-card">
				<p className="eyebrow">ΔΙΑΧΕΙΡΙΣΗ</p>

				<h1>Σύνδεση</h1>

				{message && <p className="notice">{message}</p>}

				{step === "password" ? (
					<form className="form-grid" onSubmit={submitPassword}>
						<div className="form-field">
							<label htmlFor="email">Email</label>

							<input
								id="email"
								type="email"
								autoComplete="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
						</div>

						<div className="form-field">
							<label htmlFor="password">Κωδικός</label>

							<input
								id="password"
								type="password"
								autoComplete="current-password"
								required
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
						</div>

						<button className="button" disabled={loading} type="submit">
							{loading ? "Σύνδεση…" : "Σύνδεση"}
						</button>
					</form>
				) : (
					<form className="form-grid" onSubmit={submitCode}>
						<div className="form-field">
							<label htmlFor="code">Κωδικός από την εφαρμογή αυθεντικοποίησης</label>

							<input
								id="code"
								inputMode="numeric"
								autoComplete="one-time-code"
								pattern="[0-9]{6}"
								maxLength={6}
								required
								value={code}
								onChange={(e) => setCode(e.target.value)}
							/>
						</div>

						<button className="button" disabled={loading} type="submit">
							{loading ? "Έλεγχος…" : "Επιβεβαίωση"}
						</button>
					</form>
				)}
			</div>
		</main>
	);
}

export default function LoginPage() {
	return (
		<Suspense
			fallback={
				<main className="login-wrap">
					<div className="login-card form-card">
						<p>Φόρτωση…</p>
					</div>
				</main>
			}
		>
			<LoginForm />
		</Suspense>
	);
}
