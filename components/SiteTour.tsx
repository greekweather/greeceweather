"use client";

import { useCallback, useEffect, useState } from "react";
import { enablePush, usePush } from "@/lib/push-client";

// A short welcome tour, shown once to a NEW visitor.
//   - Someone who has already used the site (the service worker controls the page from the very
//     first moment) never sees it by itself: it is marked as seen without being shown.
//   - Anyone can open it again from the footer ("Γνωριμία με το site").
//   - It is never shown in the admin panel.

const SEEN = "gw-tour-seen-v1";
const OPEN_EVENT = "gw-tour-open";

type Step = { title: string; body: string; icon: string };

const STEPS: Step[] = [
	{
		icon: "👋",
		title: "Καλώς ήρθες στο GreeceWeather",
		body: "Πρόγνωση και ανάλυση καιρού για την Ελλάδα, από ανθρώπους που τον παρακολουθούν. Δες σε μισό λεπτό τι υπάρχει εδώ.",
	},
	{
		icon: "🗺️",
		title: "Χάρτες πρόγνωσης",
		body: "Στους 'Χάρτες' υπάρχουν προγνώσεις με πιθανότητες, σαν αυτές του NHC. Μπορείς να κατεβάσεις ή να μοιραστείς κάθε χάρτη, και να βρεις και παλαιότερους στο αρχείο.",
	},
	{
		icon: "📰",
		title: "Άρθρα",
		body: "Στα 'Άρθρα' υπάρχουν προγνώσεις, αναλύσεις και εξηγήσεις των φαινομένων. Φίλτραρε με ετικέτες ή ψάξε με συγκεκριμένες λέξεις.",
	},
	{
		icon: "🔔",
		title: "Ειδοποιήσεις",
		body: "Λάβε ειδοποίηση όταν βγαίνει νέος χάρτης, νέο άρθρο ή έκτακτο δελτίο. Διαλέγεις μόνο όσα θες, και τις σβήνεις όποτε θες από το κουδούνι.",
	},
	{
		icon: "📲",
		title: "Βάλ' το στην αρχική οθόνη",
		body: "Σαν εφαρμογή, χωρίς κατέβασμα από κατάστημα. Στο iPhone: Κοινοποίηση → «Προσθήκη στην αρχική οθόνη». Σε Android/υπολογιστή: κουμπί «Εγκατάσταση» στο κάτω μέρος της σελίδας.",
	},
];

export function openTour() {
	window.dispatchEvent(new Event(OPEN_EVENT));
}

function markSeen() {
	try {
		localStorage.setItem(SEEN, "1");
	} catch {}
}

export function SiteTour() {
	const [open, setOpen] = useState(false);
	const [index, setIndex] = useState(0);
	const { state } = usePush();

	const close = useCallback(() => {
		setOpen(false);
		markSeen();
	}, []);

	useEffect(() => {
		const show = () => {
			setIndex(0);
			setOpen(true);
		};

		window.addEventListener(OPEN_EVENT, show);

		let seen = false;

		try {
			seen = localStorage.getItem(SEEN) === "1";
		} catch {
			seen = true; // storage blocked: do not show it at every page
		}

		// already controlled by the service worker = has been here before the tour existed
		const returning = Boolean(navigator.serviceWorker?.controller);
		const admin = window.location.pathname.startsWith("/admin");
		let timer: number | undefined;

		if (!seen && returning) markSeen();
		else if (!seen && !admin) timer = window.setTimeout(show, 1200);

		return () => {
			window.removeEventListener(OPEN_EVENT, show);
			window.clearTimeout(timer);
		};
	}, []);

	useEffect(() => {
		if (!open) return;

		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") close();
		};
		const previous = document.body.style.overflow;

		document.body.style.overflow = "hidden";
		window.addEventListener("keydown", onKey);

		return () => {
			document.body.style.overflow = previous;
			window.removeEventListener("keydown", onKey);
		};
	}, [open, close]);

	if (!open) return null;

	const step = STEPS[index];
	const last = index === STEPS.length - 1;
	const canEnable = step.icon === "🔔" && state === "off";

	return (
		<div
			className="tour-overlay"
			role="dialog"
			aria-modal="true"
			aria-labelledby="tour-title"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) close();
			}}
		>
			<div className="tour-card">
				<div className="tour-icon" aria-hidden="true">
					{step.icon}
				</div>

				<h2 id="tour-title">{step.title}</h2>
				<p>{step.body}</p>

				{canEnable && (
					<button type="button" className="button secondary" onClick={() => void enablePush()}>
						Ενεργοποίηση ειδοποιήσεων
					</button>
				)}

				<div className="tour-dots" aria-hidden="true">
					{STEPS.map((item, position) => (
						<span key={item.title} className={position === index ? "active" : ""} />
					))}
				</div>

				<div className="tour-actions">
					{last ? (
						<span />
					) : (
						<button type="button" className="tour-skip" onClick={close}>
							Παράλειψη
						</button>
					)}

					<div className="tour-nav">
						{index > 0 && (
							<button
								type="button"
								className="button secondary"
								onClick={() => setIndex(index - 1)}
							>
								Πίσω
							</button>
						)}

						<button
							type="button"
							className="button"
							onClick={() => (last ? close() : setIndex(index + 1))}
						>
							{last ? "Ξεκίνα" : "Επόμενο"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

/** Footer link that opens the tour again. */
export function TourButton() {
	return (
		<div className="install-app">
			<button type="button" className="install-app-button" onClick={openTour}>
				Γνωριμία με το site
			</button>
		</div>
	);
}
