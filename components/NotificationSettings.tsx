"use client";

import { useEffect, useState } from "react";
import {
	closeSettings,
	disablePush,
	openGuide,
	saveTopics,
	sendTestPush,
	useTopics,
} from "@/lib/push-client";
import { PUSH_TOPICS, type PushTopic, TOPIC_LABELS } from "@/lib/push-topics";

// The panel where the visitor chooses which notifications this device receives:
// maps, articles, emergency bulletins, or all of them. It opens right after notifications are
// turned on, and from the bell / footer button afterwards.

function Switch({
	checked,
	onChange,
	label,
	hint,
}: {
	checked: boolean;
	onChange: (next: boolean) => void;
	label: string;
	hint?: string;
}) {
	return (
		<label className="push-switch">
			<span>
				<strong>{label}</strong>
				{hint && <small>{hint}</small>}
			</span>
			<input
				type="checkbox"
				role="switch"
				aria-checked={checked}
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
			/>
			<span className="push-switch-track" aria-hidden="true" />
		</label>
	);
}

export function NotificationSettings() {
	const topics = useTopics();
	const [note, setNote] = useState("");
	const [testing, setTesting] = useState(false);
	const [sent, setSent] = useState(false);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") closeSettings();
		};

		window.addEventListener("keydown", onKey);

		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const all = PUSH_TOPICS.every((topic) => topics.includes(topic));

	async function change(next: PushTopic[]) {
		setNote("");

		if (!(await saveTopics(next))) {
			setNote("Η επιλογή δεν αποθηκεύτηκε στον server. Δοκίμασε ξανά σε λίγο.");
		}
	}

	function toggle(topic: PushTopic, on: boolean) {
		void change(on ? [...topics, topic] : topics.filter((item) => item !== topic));
	}

	async function runTest() {
		setTesting(true);
		setNote("");
		setSent(false);

		const outcome = await sendTestPush();

		setTesting(false);

		if (outcome === "sent") setSent(true);
		else if (outcome === "no-server-keys") {
			setNote("Ο server δεν έχει ρυθμιστεί για ειδοποιήσεις (λείπουν τα VAPID keys).");
		} else if (outcome === "gone") {
			setNote("Η συσκευή δεν είναι πια καταχωρημένη. Ενεργοποίησε τις ειδοποιήσεις ξανά.");
		} else setNote("Η δοκιμή δεν μπόρεσε να σταλεί. Δοκίμασε ξανά σε λίγο.");
	}

	return (
		<div
			className="push-guide-overlay"
			role="dialog"
			aria-modal="true"
			aria-labelledby="push-settings-title"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) closeSettings();
			}}
		>
			<div className="push-guide push-settings">
				<h2 id="push-settings-title">Ποιες ειδοποιήσεις θέλεις;</h2>
				<p>Η επιλογή ισχύει για αυτή τη συσκευή και αποθηκεύεται αμέσως.</p>

				<div className="push-switches">
					<Switch
						checked={all}
						onChange={(on) => void change(on ? [...PUSH_TOPICS] : [])}
						label="Όλες"
						hint="Χάρτες, άρθρα και έκτακτα δελτία"
					/>

					{PUSH_TOPICS.map((topic) => (
						<Switch
							key={topic}
							checked={topics.includes(topic)}
							onChange={(on) => toggle(topic, on)}
							label={TOPIC_LABELS[topic].title}
							hint={TOPIC_LABELS[topic].hint}
						/>
					))}
				</div>

				{topics.length === 0 && (
					<p className="push-guide-note">
						Δεν έχεις επιλέξει τίποτα: δεν θα έρχονται ειδοποιήσεις.
					</p>
				)}

				{sent && (
					<p className="push-settings-ok">
						Η δοκιμή στάλθηκε. Αν δεν δεις ειδοποίηση σε λίγα δευτερόλεπτα,{" "}
						<button
							type="button"
							className="push-link"
							onClick={() => {
								closeSettings();
								openGuide("not-arriving");
							}}
						>
							δες γιατί
						</button>
						.
					</p>
				)}

				{note && <p className="push-guide-note">{note}</p>}

				<div className="push-guide-actions">
					<button
						type="button"
						className="button secondary"
						onClick={() => void disablePush().then(closeSettings)}
					>
						Απενεργοποίηση
					</button>
					<button
						type="button"
						className="button secondary"
						disabled={testing}
						onClick={() => void runTest()}
					>
						{testing ? "Αποστολή…" : "Δοκιμή"}
					</button>
					<button type="button" className="button" onClick={closeSettings}>
						Τέλος
					</button>
				</div>
			</div>
		</div>
	);
}
