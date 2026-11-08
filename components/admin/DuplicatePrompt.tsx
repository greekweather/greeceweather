"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

type Existing = { name: string; url: string };
type Answer = "upload" | "existing";

type Pending = {
	file: File;
	existing: Existing;
	existingLabel: string;
	resolve: (answer: Answer) => void;
};

// A promise-based replacement for window.confirm() in the GreeceWeather admin style:
//   const { ask, dialog } = useDuplicatePrompt();
//   const answer = await ask(file, existingImage, "Χρήση της υπάρχουσας");
//   ... render {dialog} once somewhere in the component.
export function useDuplicatePrompt(): {
	ask: (file: File, existing: Existing, existingLabel?: string) => Promise<Answer>;
	dialog: ReactNode;
} {
	const [pending, setPending] = useState<Pending | null>(null);
	const [preview, setPreview] = useState("");
	const uploadRef = useRef<HTMLButtonElement>(null);

	const ask = useCallback(
		(file: File, existing: Existing, existingLabel = "Χρήση της υπάρχουσας") =>
			new Promise<Answer>((resolve) => setPending({ file, existing, existingLabel, resolve })),
		[],
	);

	useEffect(() => {
		if (!pending) return;

		const url = URL.createObjectURL(pending.file);

		setPreview(url);
		uploadRef.current?.focus();

		return () => URL.revokeObjectURL(url);
	}, [pending]);

	function answer(value: Answer) {
		pending?.resolve(value);
		setPending(null);
	}

	const dialog = pending ? (
		<div className="dupe-overlay">
			<div
				className="dupe-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="dupe-title"
				onKeyDown={(event) => {
					if (event.key === "Escape") answer("existing");
				}}
			>
				<h2 id="dupe-title">Μοιάζει με υπάρχουσα εικόνα</h2>

				<p>Η εικόνα που ανεβάζεις φαίνεται σχεδόν ίδια με μία που υπάρχει ήδη στη βιβλιοθήκη.</p>

				<div className="dupe-compare">
					<figure>
						{/* biome-ignore lint/performance/noImgElement: local blob preview */}
						<img src={preview} alt="" />
						<figcaption>
							<strong>Νέα</strong>
							<span title={pending.file.name}>{pending.file.name}</span>
						</figcaption>
					</figure>

					<figure>
						{/* biome-ignore lint/performance/noImgElement: library image, plain preview */}
						<img src={pending.existing.url} alt="" />
						<figcaption>
							<strong>Υπάρχουσα</strong>
							<span title={pending.existing.name}>{pending.existing.name}</span>
						</figcaption>
					</figure>
				</div>

				<div className="dupe-actions">
					<button
						className="button secondary"
						type="button"
						onClick={() => answer("upload")}
						ref={uploadRef}
					>
						Ανέβασμα παρ' όλα αυτά
					</button>

					<button className="button" type="button" onClick={() => answer("existing")}>
						{pending.existingLabel}
					</button>
				</div>
			</div>
		</div>
	) : null;

	return { ask, dialog };
}
