"use client";

import Image from "next/image";
import { useState } from "react";

import { useDuplicatePrompt } from "@/components/admin/DuplicatePrompt";
import { findVisualDuplicate, indexUploaded } from "@/lib/image-hash";
import { renameImage } from "@/lib/image-rename";
import { uploadKeepingName } from "@/lib/image-upload";
import { storageFileBase } from "@/lib/slug";
import { createClient } from "@/lib/supabase/client";

type MediaFile = {
	name: string;
	url: string;
	created_at: string | null;
	size: number | null;
	content_type: string | null;
};

async function optimizeImage(file: File): Promise<Blob> {
	const MAX_WIDTH = 2000;
	const QUALITY = 0.8;

	const image = new window.Image();

	const objectUrl = URL.createObjectURL(file);

	try {
		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () => reject(new Error("Δεν ήταν δυνατή η ανάγνωση της εικόνας."));
			image.src = objectUrl;
		});

		const scale = Math.min(1, MAX_WIDTH / image.naturalWidth);

		const width = Math.round(image.naturalWidth * scale);
		const height = Math.round(image.naturalHeight * scale);

		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;

		const context = canvas.getContext("2d");

		if (!context) {
			throw new Error("Δεν ήταν δυνατή η δημιουργία canvas.");
		}

		context.drawImage(image, 0, 0, width, height);

		const blob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(result) => {
					if (result) {
						resolve(result);
					} else {
						reject(new Error("Δεν ήταν δυνατή η συμπίεση της εικόνας."));
					}
				},
				"image/webp",
				QUALITY,
			);
		});

		return blob;
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

export function MediaLibrary({
	initialFiles,
	libraryIndex,
	query,
}: {
	initialFiles: MediaFile[];
	/** every image in the bucket (name + address), for the duplicate check */
	libraryIndex: { name: string; url: string }[];
	query: string;
}) {
	const [files, setFiles] = useState(initialFiles);
	const [uploading, setUploading] = useState(false);
	const [message, setMessage] = useState("");
	const [fileToDelete, setFileToDelete] = useState<string | null>(null);
	const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
	const [dragging, setDragging] = useState(false);
	const [scan, setScan] = useState("");
	const [renaming, setRenaming] = useState<{ name: string; value: string } | null>(null);
	const [renameBusy, setRenameBusy] = useState(false);

	const supabase = createClient();
	const { ask, dialog } = useDuplicatePrompt();

	// One file: returns the stored entry, or throws with a readable reason.
	async function uploadOne(file: File): Promise<MediaFile> {
		const optimized = await optimizeImage(file);

		// keeps the name the file has on the computer; a taken name becomes name-2, name-3…
		const fileName = await uploadKeepingName("", `${storageFileBase(file.name)}.webp`, optimized);

		const { data: publicUrl } = supabase.storage.from("post-images").getPublicUrl(fileName);

		return {
			name: fileName,
			url: publicUrl.publicUrl,
			created_at: new Date().toISOString(),
			size: optimized.size,
			content_type: "image/webp",
		};
	}

	// Any number of files, one after the other (keeps phones from running out of memory).
	async function uploadMany(list: File[]) {
		const images = list.filter((file) => file.type.startsWith("image/"));
		const skipped = list.length - images.length;

		if (images.length === 0) {
			setMessage("Δεν επιλέχθηκαν εικόνες.");
			return;
		}

		setUploading(true);
		setMessage("");

		const failures: string[] = [];
		const skippedDuplicates: string[] = [];
		const library = [...libraryIndex];
		let done = 0;

		for (const [index, file] of images.entries()) {
			setProgress({ current: index + 1, total: images.length });

			try {
				const lookalike = await findVisualDuplicate(file, library, (checked, total) =>
					setScan(`Έλεγχος για διπλότυπα… ${checked}/${total}`),
				);

				setScan("");

				if (lookalike) {
					const answer = await ask(file, lookalike, "Παράλειψη");

					if (answer === "existing") {
						skippedDuplicates.push(file.name);
						continue;
					}
				}

				const stored = await uploadOne(file);

				await indexUploaded(file, stored.url);
				library.unshift({ name: stored.name, url: stored.url });
				setFiles((current) => [stored, ...current]);
				done += 1;
			} catch (error) {
				failures.push(
					`${file.name}: ${error instanceof Error ? error.message : "άγνωστο σφάλμα"}`,
				);
			}
		}

		setProgress(null);
		setUploading(false);
		setMessage(
			[
				done > 0 ? `Ανέβηκαν ${done} από ${images.length} εικόνες.` : "Δεν ανέβηκε καμία εικόνα.",
				skippedDuplicates.length > 0
					? `Παραλείφθηκαν ως διπλότυπα: ${skippedDuplicates.join(", ")}.`
					: "",
				skipped > 0 ? `${skipped} αρχεία που δεν ήταν εικόνες αγνοήθηκαν.` : "",
				failures.length > 0 ? `Απέτυχαν: ${failures.join(" · ")}` : "",
			]
				.filter(Boolean)
				.join(" "),
		);
	}

	async function deleteFile(name: string) {
		setMessage("");

		const { error } = await supabase.storage.from("post-images").remove([name]);

		if (error) {
			setMessage(`Σφάλμα διαγραφής: ${error.message}`);
			return;
		}

		setFiles((current) => current.filter((file) => file.name !== name));
		setMessage("Η εικόνα διαγράφηκε.");
		setFileToDelete(null);
	}

	async function submitRename() {
		if (!renaming || renameBusy) return;

		setRenameBusy(true);
		setMessage("");

		try {
			const result = await renameImage(renaming.name, renaming.value);

			setFiles((current) =>
				current.map((file) =>
					file.name === renaming.name ? { ...file, name: result.name, url: result.url } : file,
				),
			);
			setRenaming(null);
			setMessage(
				result.postsUpdated > 0
					? `Η εικόνα μετονομάστηκε σε «${result.name}» και ενημερώθηκαν ${result.postsUpdated} άρθρα.`
					: `Η εικόνα μετονομάστηκε σε «${result.name}». Δεν τη χρησιμοποιεί κανένα άρθρο.`,
			);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Η μετονομασία απέτυχε.");
		} finally {
			setRenameBusy(false);
		}
	}

	async function copyUrl(url: string) {
		await navigator.clipboard.writeText(url);
		setMessage("Το URL αντιγράφηκε.");
	}

	return (
		<div>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: drop zone; the file input inside is the keyboard route */}
			<div
				className={`media-upload-card${dragging ? " dragging" : ""}`}
				onDragOver={(event) => {
					event.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={(event) => {
					event.preventDefault();
					setDragging(false);

					if (!uploading) void uploadMany(Array.from(event.dataTransfer.files));
				}}
			>
				<label className="media-upload-label">
					<span>
						{progress
							? scan || `Ανέβασμα ${progress.current} από ${progress.total}…`
							: "Ανέβασε εικόνες (μία ή πολλές)"}
					</span>

					<input
						type="file"
						multiple
						accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
						disabled={uploading}
						onChange={(event) => {
							const chosen = Array.from(event.target.files ?? []);

							event.target.value = "";

							if (chosen.length > 0) void uploadMany(chosen);
						}}
					/>
				</label>

				{progress && (
					<progress
						className="media-upload-progress"
						value={progress.current - 1}
						max={progress.total}
					/>
				)}

				<p>JPG, PNG, WebP, GIF ή AVIF. Διάλεξε πολλά μαζί ή σύρε τα εδώ.</p>
			</div>

			{message && <div className="notice success">{message}</div>}

			<form className="media-search" action="/admin/media" method="get">
				<span className="media-search-icon" aria-hidden="true">
					⌕
				</span>

				<input
					type="search"
					name="q"
					defaultValue={query}
					placeholder="Αναζήτηση εικόνας με όνομα…"
					aria-label="Αναζήτηση εικόνας με όνομα"
				/>

				<button className="button" type="submit">
					Αναζήτηση
				</button>

				{query && (
					<a className="button secondary" href="/admin/media">
						Καθαρισμός
					</a>
				)}
			</form>

			{files.length === 0 ? (
				<div className="form-card">
					<p>
						{query
							? `Καμία εικόνα με όνομα «${query}».`
							: "Δεν υπάρχουν εικόνες στο Media Library."}
					</p>
				</div>
			) : (
				<div className="media-grid">
					{files.map((file) => (
						<article className="media-card" key={file.name}>
							<div className="media-preview">
								<Image src={file.url} alt={file.name} width={700} height={438} />
							</div>

							<div className="media-card-body">
								{renaming?.name === file.name ? (
									<form
										className="media-rename"
										onSubmit={(event) => {
											event.preventDefault();
											void submitRename();
										}}
									>
										<input
											type="text"
											value={renaming.value}
											aria-label="Νέο όνομα εικόνας"
											// biome-ignore lint/a11y/noAutofocus: opened by the visitor's own click
											autoFocus
											onChange={(event) => setRenaming({ ...renaming, value: event.target.value })}
											onKeyDown={(event) => {
												if (event.key === "Escape") setRenaming(null);
											}}
										/>

										<button className="button" type="submit" disabled={renameBusy}>
											{renameBusy ? "…" : "OK"}
										</button>

										<button
											className="button secondary"
											type="button"
											disabled={renameBusy}
											onClick={() => setRenaming(null)}
										>
											Ακύρωση
										</button>
									</form>
								) : (
									<strong title={file.name}>{file.name}</strong>
								)}

								{file.size !== null && <span>{Math.round(file.size / 1024)} KB</span>}

								<div className="media-actions">
									<button
										className="button secondary"
										type="button"
										onClick={() => void copyUrl(file.url)}
									>
										Copy URL
									</button>

									<button
										className="button secondary"
										type="button"
										onClick={() =>
											setRenaming({ name: file.name, value: file.name.replace(/\.[a-z0-9]{2,5}$/i, "") })
										}
									>
										Μετονομασία
									</button>

									<button
										className="button danger"
										type="button"
										onClick={() => setFileToDelete(file.name)}
									>
										Διαγραφή
									</button>
								</div>
							</div>
						</article>
					))}
				</div>
			)}

			{dialog}

			{fileToDelete && (
				<div className="delete-confirm-overlay">
					<div
						className="delete-confirm-dialog"
						role="dialog"
						aria-modal="true"
						aria-labelledby="media-delete-confirm-title"
					>
						<h2 id="media-delete-confirm-title">Διαγραφή εικόνας</h2>

						<p>
							Είσαι σίγουρος ότι θέλεις να διαγράψεις την εικόνα{" "}
							<strong className="delete-confirm-name">&ldquo;{fileToDelete}&rdquo;</strong>
						</p>

						<p className="delete-confirm-warning">Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.</p>

						<div className="delete-confirm-actions">
							<button
								className="button secondary"
								type="button"
								onClick={() => setFileToDelete(null)}
							>
								Ακύρωση
							</button>

							<button
								className="button danger"
								type="button"
								onClick={() => void deleteFile(fileToDelete)}
							>
								Διαγραφή
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
