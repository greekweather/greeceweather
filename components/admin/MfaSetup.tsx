"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function MfaSetup() {
	const router = useRouter();

	const [factorId, setFactorId] = useState("");
	const [qr, setQr] = useState("");
	const [secret, setSecret] = useState("");
	const [code, setCode] = useState("");
	const [message, setMessage] = useState("");
	const [loading, setLoading] = useState(false);

	async function start() {
		setLoading(true);
		setMessage("");

		const supabase = createClient();

		// remove abandoned, unfinished attempts
		const { data: list } = await supabase.auth.mfa.listFactors();

		for (const factor of list?.all ?? []) {
			if (factor.factor_type === "totp" && factor.status === "unverified") {
				await supabase.auth.mfa.unenroll({ factorId: factor.id });
			}
		}

		const { data, error } = await supabase.auth.mfa.enroll({
			factorType: "totp",
			friendlyName: "GreeceWeather admin",
		});

		if (error || !data) {
			setMessage("Δεν ήταν δυνατή η έναρξη της ρύθμισης.");
			setLoading(false);
			return;
		}

		setFactorId(data.id);
		setQr(data.totp.qr_code);
		setSecret(data.totp.secret);
		setLoading(false);
	}

	async function verify(e: React.FormEvent) {
		e.preventDefault();

		setLoading(true);
		setMessage("");

		const supabase = createClient();

		const { error } = await supabase.auth.mfa.challengeAndVerify({
			factorId,
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

	if (!factorId) {
		return (
			<>
				{message && <p className="notice">{message}</p>}

				<p>Θα χρειαστείς μια εφαρμογή αυθεντικοποίησης στο κινητό σου.</p>

				<button className="button" type="button" disabled={loading} onClick={start}>
					{loading ? "Έναρξη…" : "Ξεκίνα τη ρύθμιση"}
				</button>
			</>
		);
	}

	return (
		<form className="form-grid" onSubmit={verify}>
			{message && <p className="notice">{message}</p>}

			<p>1. Σκάναρε τον κωδικό QR με την εφαρμογή (ή πληκτρολόγησε το κλειδί).</p>

			<Image
				src={qr}
				alt="Κωδικός QR για την εφαρμογή αυθεντικοποίησης"
				width={200}
				height={200}
			/>

			<p>
				Κλειδί: <code>{secret}</code>
			</p>

			<div className="form-field">
				<label htmlFor="mfa-code">2. Κωδικός 6 ψηφίων από την εφαρμογή</label>

				<input
					id="mfa-code"
					inputMode="numeric"
					autoComplete="one-time-code"
					pattern="[0-9]{6}"
					maxLength={6}
					required
					value={code}
					onChange={(e) => setCode(e.target.value)}
				/>
			</div>

			<button className="button" type="submit" disabled={loading}>
				{loading ? "Έλεγχος…" : "Ενεργοποίηση"}
			</button>
		</form>
	);
}
