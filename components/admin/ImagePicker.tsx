"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { findVisualDuplicate } from "@/lib/image-hash";
import { listImages, type StoredImage, uploadImage } from "@/lib/image-upload";

export function ImagePicker({
	currentUrl,
	onSelect,
}: {
	currentUrl: string;
	onSelect: (url: string, alt?: string) => void;
}) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const altByUrl = useRef<Record<string, string>>({});

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
		onSelect(selected, altByUrl.current[selected]);
		close();
	}

	async function addNew(file: File | undefined) {
		if (!file) return;
		setBusy(true);
		setStatus("Έλεγχος για διπλότυπα…");
		try {
			const lookalike = await findVisualDuplicate(file, images, (done, total) =>
				setStatus(`Έλεγχος για διπλότυπα… ${done}/${total}`),
			);

			if (lookalike) {
				const name = lookalike.path.split("/").pop();
				const upload = window.confirm(
					`Η εικόνα μοιάζει πολύ με την υπάρχουσα «${name}».\n\n` +
						"OK = ανέβασμα παρ' όλα αυτά\nΑκύρωση = χρήση της υπάρχουσας",
				);

				if (!upload) {
					setSelected(lookalike.url);
					setQuery("");
					setStatus(`Επιλέχθηκε η υπάρχουσα «${name}».`);
					return;
				}
			}

			setStatus("Συμπίεση και upload…");

			const image = await uploadImage(file);
			altByUrl.current[image.url] = file.name.replace(/\.[^.]+$/, "");
			setImages((current) => [image, ...current]);
			setSelected(image.url);
			setStatus("Η εικόνα ανέβηκε και προστέθηκε στη βιβλιοθήκη.");
		} catch (e) {
			setStatus(e instanceof Error ? e.message : "Αποτυχία upload.");
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
						<span>{busy ? "Ανέβασμα…" : "+ Προσθήκη νέας"}</span>

						<input
							type="file"
							accept="image/jpeg,image/png,image/webp"
							disabled={busy}
							onChange={(e) => {
								void addNew(e.target.files?.[0]);
								e.target.value = "";
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
										<Image src={image.url} alt="" width={240} height={150} />
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
		</div>
	);
}
