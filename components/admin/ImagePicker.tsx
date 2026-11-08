"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useDuplicatePrompt } from "@/components/admin/DuplicatePrompt";
import { findVisualDuplicate, indexUploaded } from "@/lib/image-hash";
import { listImages, type StoredImage, uploadImage } from "@/lib/image-upload";

export function ImagePicker({
	currentUrl,
	onSelect,
}: {
	currentUrl: string;
	onSelect: (url: string) => void;
}) {
	const { ask, dialog: duplicateDialog } = useDuplicatePrompt();
	const dialogRef = useRef<HTMLDialogElement>(null);

	const [images, setImages] = useState<StoredImage[]>([]);
	const [selected, setSelected] = useState("");
	const [loading, setLoading] = useState(false);
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState("");
	const [query, setQuery] = useState("");

	async function load() {
		setLoading(true);
		try {
			setImages(await listImages());
		} catch (e) {
			setStatus(e instanceof Error ? e.message : "Δεν φορτώθηκαν οι εικόνες.");
		} finally {
			setLoading(false);
		}
	}

	function open() {
		// start from an empty list: never show what an earlier visit saw (deleted images)
		setImages([]);
		setSelected(currentUrl);
		setStatus("");
		setQuery("");
		dialogRef.current?.showModal();
		void load();
	}

	function close() {
		dialogRef.current?.close();
	}

	function choose() {
		if (!selected) return;
		onSelect(selected);
		close();
	}

	// One or many files, one after the other. The last uploaded (or matched) image is selected.
	async function addMany(list: File[]) {
		const files = list.filter((file) => file.type.startsWith("image/"));

		if (files.length === 0) return;

		setBusy(true);

		const library = [...images];
		let added = 0;
		let reused = 0;
		const failed: string[] = [];

		try {
			for (const [index, file] of files.entries()) {
				const prefix = files.length > 1 ? `${index + 1}/${files.length} · ` : "";

				try {
					setStatus(`${prefix}Έλεγχος για διπλότυπα…`);

					const lookalike = await findVisualDuplicate(file, library, (done, total) =>
						setStatus(`${prefix}Έλεγχος για διπλότυπα… ${done}/${total}`),
					);

					if (lookalike) {
						const answer = await ask(
							file,
							{ name: lookalike.path.split("/").pop() ?? lookalike.path, url: lookalike.url },
							"Χρήση της υπάρχουσας",
						);

						if (answer === "existing") {
							setSelected(lookalike.url);
							reused += 1;
							continue;
						}
					}

					setStatus(`${prefix}Συμπίεση και upload…`);

					const image = await uploadImage(file);

					await indexUploaded(file, image.url);
					library.unshift(image);
					setImages((current) => [image, ...current]);
					setSelected(image.url);
					added += 1;
				} catch (e) {
					failed.push(`${file.name}: ${e instanceof Error ? e.message : "αποτυχία"}`);
				}
			}

			setQuery("");
			setStatus(
				[
					added > 0 ? `Ανέβηκαν ${added} εικόνες.` : "",
					reused > 0 ? `Χρησιμοποιήθηκε υπάρχουσα (${reused}).` : "",
					failed.length > 0 ? `Απέτυχαν: ${failed.join(" · ")}` : "",
				]
					.filter(Boolean)
					.join(" "),
			);
		} finally {
			setBusy(false);
		}
	}

	const needle = query.trim().toLowerCase();
	const visible = needle
		? images.filter((image) => image.path.toLowerCase().includes(needle))
		: images;

	return (
		<div className="form-field">
			<div className="form-label">Εικόνα άρθρου</div>

			<div>
				<button className="button secondary" type="button" onClick={open}>
					{currentUrl ? "Αλλαγή εικόνας" : "Επιλογή εικόνας"}
				</button>
			</div>

			<small>Διάλεξε από τις εικόνες που υπάρχουν ή ανέβασε νέα από τον υπολογιστή.</small>

			<dialog ref={dialogRef} className="image-picker" aria-labelledby="image-picker-title">
				<div className="image-picker-head">
					<h2 id="image-picker-title">Βιβλιοθήκη εικόνων</h2>

					<button className="button secondary" type="button" onClick={close}>
						Κλείσιμο
					</button>
				</div>

				<div className="image-picker-toolbar">
					<label className="button image-picker-add">
						<span>{busy ? "Ανέβασμα…" : "+ Προσθήκη (μία ή πολλές)"}</span>

						<input
							type="file"
							accept="image/jpeg,image/png,image/webp"
							multiple
							disabled={busy}
							onChange={(e) => {
								const chosen = Array.from(e.target.files ?? []);

								e.target.value = "";
								void addMany(chosen);
							}}
						/>
					</label>

					<input
						type="search"
						className="image-picker-search"
						placeholder="Αναζήτηση ονόματος…"
						aria-label="Αναζήτηση εικόνας με όνομα"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>

					<span className="image-picker-status" role="status" aria-live="polite">
						{status}
					</span>
				</div>

				<div className="image-picker-body">
					{loading && images.length === 0 ? (
						<p>Φόρτωση…</p>
					) : images.length === 0 ? (
						<p>Δεν υπάρχουν εικόνες ακόμα. Πάτα «Προσθήκη νέας».</p>
					) : visible.length === 0 ? (
						<p>Καμία εικόνα με αυτό το όνομα.</p>
					) : (
						<div className="image-picker-grid">
							{visible.map((image) => {
								const isSelected = image.url === selected;

								return (
									<button
										key={image.path}
										type="button"
										className={`image-picker-item${isSelected ? " selected" : ""}`}
										aria-pressed={isSelected}
										aria-label={image.path.split("/").pop()}
										title={image.path.split("/").pop()}
										onClick={() => setSelected(image.url)}
									>
										<Image
											src={image.url}
											alt=""
											width={240}
											height={150}
											onError={() =>
												setImages((current) => current.filter((item) => item.url !== image.url))
											}
										/>
										<span className="image-picker-name">{image.path.split("/").pop()}</span>
									</button>
								);
							})}
						</div>
					)}
				</div>

				<div className="image-picker-foot">
					<button className="button secondary" type="button" onClick={close}>
						Ακύρωση
					</button>

					<button className="button" type="button" disabled={!selected} onClick={choose}>
						Χρήση εικόνας
					</button>
				</div>
			</dialog>

			{duplicateDialog}
		</div>
	);
}
