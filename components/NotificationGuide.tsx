"use client";

import { useEffect, useState } from "react";
import {
	closeGuide,
	detectPlatform,
	dismissMessage,
	enablePush,
	type GuideKind,
	openGuide,
	type Platform,
	pushMessage,
	refreshPush,
	sendTestPush,
	useGuide,
	useMessages,
	usePush,
	wasOn,
} from "@/lib/push-client";

// In-app help for notifications. Three things live here:
//   - a step-by-step guide, matched to the visitor's phone / browser, for when notifications
//     are blocked, the site is not installed yet (iPhone) or a test message did not arrive
//   - a small card when a notification arrives while the site is open
//   - a card when notifications that used to work have been switched off in the settings

function steps(kind: GuideKind, platform: Platform): { title: string; items: string[] } {
	if (kind === "ios-install") {
		return {
			title: "Ειδοποιήσεις στο iPhone και στο iPad",
			items: [
				"Άνοιξε το site στο Safari και πάτα το κουμπί Κοινοποίηση (το τετράγωνο με το βέλος).",
				"Διάλεξε «Προσθήκη στην αρχική οθόνη» και πάτα «Προσθήκη».",
				"Άνοιξε το GreeceWeather από το νέο εικονίδιο στην αρχική οθόνη, όχι από το Safari.",
				"Πάτα το καμπανάκι πάνω δεξιά και επίτρεψε τις ειδοποιήσεις.",
			],
		};
	}

	const where = (() => {
		if (platform.os === "ios") {
			return [
				"Άνοιξε τις Ρυθμίσεις του iPhone και πήγαινε στις Ειδοποιήσεις.",
				"Διάλεξε το GreeceWeather από τη λίστα.",
				"Ενεργοποίησε το «Επιτρέπονται οι ειδοποιήσεις».",
			];
		}

		if (platform.os === "android") {
			return platform.standalone
				? [
						"Κράτα πατημένο το εικονίδιο της εφαρμογής GreeceWeather και διάλεξε «Πληροφορίες εφαρμογής».",
						"Πάτα «Ειδοποιήσεις» και ενεργοποίησέ τες.",
					]
				: [
						"Πάτα το εικονίδιο δίπλα στη διεύθυνση (κλειδί ή ρυθμίσεις) και μετά «Ρυθμίσεις site» ή «Άδειες».",
						"Βρες τις «Ειδοποιήσεις» και διάλεξε «Να επιτρέπονται».",
						"Αν δεν υπάρχει εκεί: Ρυθμίσεις Android → Εφαρμογές → ο browser σου → Ειδοποιήσεις → ενεργές.",
					];
		}

		if (platform.browser === "firefox") {
			return [
				"Πάτα το εικονίδιο αριστερά από τη διεύθυνση και μετά «Άδειες».",
				"Δίπλα στις «Ειδοποιήσεις» αφαίρεσε το μπλοκάρισμα (το x).",
			];
		}

		if (platform.os === "mac" && platform.browser === "safari") {
			return [
				"Από το μενού: Safari → Ρυθμίσεις → Ιστοσελίδες → Ειδοποιήσεις.",
				"Βρες το greeceweather.gr και διάλεξε «Να επιτρέπεται».",
				"Έλεγξε και τις Ρυθμίσεις συστήματος → Ειδοποιήσεις → Safari.",
			];
		}

		return [
			"Πάτα το εικονίδιο αριστερά από τη διεύθυνση (κλειδί ή ρυθμίσεις).",
			"Βρες τις «Ειδοποιήσεις» και άλλαξε το σε «Να επιτρέπονται».",
			"Ανανέωσε τη σελίδα αν σου το ζητήσει ο browser.",
		];
	})();

	if (kind === "denied") {
		return { title: "Οι ειδοποιήσεις είναι μπλοκαρισμένες", items: where };
	}

	return {
		title: "Η δοκιμαστική ειδοποίηση δεν εμφανίστηκε;",
		items: [
			"Έλεγξε ότι δεν είναι ενεργό το «Μην ενοχλείτε» ή κάποιο Focus.",
			"Έλεγξε ότι η εξοικονόμηση μπαταρίας δεν περιορίζει τον browser ή την εφαρμογή.",
			...where,
		],
	};
}

function Guide({ kind }: { kind: GuideKind }) {
	const [platform, setPlatform] = useState<Platform | null>(null);
	const [checking, setChecking] = useState(false);
	const [note, setNote] = useState("");

	useEffect(() => setPlatform(detectPlatform()), []);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") closeGuide();
		};

		window.addEventListener("keydown", onKey);

		return () => window.removeEventListener("keydown", onKey);
	}, []);

	if (!platform) return null;

	const content = steps(kind, platform);

	async function check() {
		setChecking(true);
		setNote("");

		await refreshPush();

		if (kind === "denied") {
			if (Notification.permission === "granted") {
				await enablePush();
				closeGuide();
			} else {
				setNote("Οι ειδοποιήσεις φαίνονται ακόμα μπλοκαρισμένες. Έλεγξε ξανά τα βήματα.");
			}
		} else if (kind === "ios-install") {
			if (platform?.standalone) closeGuide();
			else {
				setNote("Ανοίγεις ακόμα το site από το Safari. Άνοιξέ το από το εικονίδιο στην αρχική οθόνη.");
			}
		} else {
			closeGuide();
		}

		setChecking(false);
	}

	return (
		<div className="push-guide-overlay">
			<div
				className="push-guide"
				role="dialog"
				aria-modal="true"
				aria-labelledby="push-guide-title"
			>
				<h2 id="push-guide-title">{content.title}</h2>

				{kind === "denied" && (
					<p>
						Έτσι δεν μπορούμε να σε ειδοποιήσουμε για νέους χάρτες και έκτακτα δελτία. Αυτό
						αλλάζει μόνο από τις ρυθμίσεις της συσκευής σου:
					</p>
				)}

				<ol>
					{content.items.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ol>

				{note && <p className="push-guide-note">{note}</p>}

				<div className="push-guide-actions">
					<button type="button" className="button secondary" onClick={closeGuide}>
						Κλείσιμο
					</button>

					<button
						type="button"
						className="button"
						onClick={() => void check()}
						disabled={checking}
					>
						{checking ? "Έλεγχος…" : kind === "not-arriving" ? "Εντάξει" : "Το έκανα, έλεγξε ξανά"}
					</button>
				</div>
			</div>
		</div>
	);
}

export function NotificationGuide() {
	const guide = useGuide();
	const messages = useMessages();
	const { state } = usePush();
	const [revokedHidden, setRevokedHidden] = useState(true);
	const [testing, setTesting] = useState(false);
	const [testNote, setTestNote] = useState("");

	// A notification that arrives while the site is open: the service worker passes it on and it
	// is shown here instead of as a system notification.
	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;

		const onMessage = (event: MessageEvent) => {
			const data = event.data as { type?: string; title?: string; body?: string; url?: string };

			if (data?.type !== "gw-push" || !data.title) return;

			pushMessage({ kind: "push", title: data.title, body: data.body ?? "", url: data.url });
		};

		navigator.serviceWorker.addEventListener("message", onMessage);

		return () => navigator.serviceWorker.removeEventListener("message", onMessage);
	}, []);

	// Notifications that used to be on are blocked now: say so, once per visit.
	useEffect(() => {
		if (state !== "denied") return;

		try {
			setRevokedHidden(sessionStorage.getItem("gw-push-revoked-hidden") === "1" || !wasOn());
		} catch {
			setRevokedHidden(!wasOn());
		}
	}, [state]);

	const showRevoked = state === "denied" && !revokedHidden;

	async function runTest(id: number) {
		setTesting(true);
		setTestNote("");

		const outcome = await sendTestPush();

		setTesting(false);

		if (outcome === "sent") {
			dismissMessage(id);
			pushMessage({
				kind: "tested",
				title: "Η δοκιμή στάλθηκε",
				body: "Αν δεν δεις ειδοποίηση σε λίγα δευτερόλεπτα, δες γιατί.",
			});
		} else if (outcome === "no-server-keys") {
			setTestNote("Ο server δεν έχει ρυθμιστεί για ειδοποιήσεις (λείπουν τα VAPID keys).");
		} else if (outcome === "gone") {
			setTestNote("Η συσκευή δεν είναι πια καταχωρημένη. Ενεργοποίησε τις ειδοποιήσεις ξανά.");
		} else {
			setTestNote("Η δοκιμή δεν μπόρεσε να σταλεί. Δοκίμασε ξανά σε λίγο.");
		}
	}

	return (
		<>
			{guide && <Guide kind={guide} />}

			<div className="push-toasts" aria-live="polite">
				{showRevoked && (
					<div className="push-toast warn" role="status">
						<div>
							<strong>Οι ειδοποιήσεις έχουν απενεργοποιηθεί</strong>
							<p>Είχες ενεργές ειδοποιήσεις, αλλά η συσκευή τις μπλόκαρε.</p>
						</div>

						<div className="push-toast-actions">
							<button type="button" className="button" onClick={() => openGuide("denied")}>
								Οδηγίες
							</button>

							<button
								type="button"
								className="push-toast-close"
								aria-label="Κλείσιμο"
								onClick={() => {
									setRevokedHidden(true);

									try {
										sessionStorage.setItem("gw-push-revoked-hidden", "1");
									} catch {}
								}}
							>
								×
							</button>
						</div>
					</div>
				)}

				{messages.map((message) => (
					<div className={`push-toast ${message.kind}`} role="status" key={message.id}>
						<div>
							<strong>{message.title}</strong>
							{message.body && <p>{message.body}</p>}
							{testNote && message.kind === "enabled" && (
								<p className="push-toast-note">{testNote}</p>
							)}
						</div>

						<div className="push-toast-actions">
							{message.kind === "push" && message.url && (
								<a
									className="button"
									href={message.url}
									onClick={() => dismissMessage(message.id)}
								>
									Άνοιγμα
								</a>
							)}

							{message.kind === "enabled" && (
								<button
									type="button"
									className="button"
									disabled={testing}
									onClick={() => void runTest(message.id)}
								>
									{testing ? "Αποστολή…" : "Δοκιμή"}
								</button>
							)}

							{message.kind === "tested" && (
								<button
									type="button"
									className="button secondary"
									onClick={() => {
										dismissMessage(message.id);
										openGuide("not-arriving");
									}}
								>
									Δεν ήρθε
								</button>
							)}

							<button
								type="button"
								className="push-toast-close"
								aria-label="Κλείσιμο"
								onClick={() => dismissMessage(message.id)}
							>
								×
							</button>
						</div>
					</div>
				))}
			</div>
		</>
	);
}
