"use client";

import Image from "next/image";
import { useState } from "react";

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

export function MediaLibrary({ initialFiles }: { initialFiles: MediaFile[] }) {
	const [files, setFiles] = useState(initialFiles);
	const [uploading, setUploading] = useState(false);
	const [message, setMessage] = useState("");
	const [fileToDelete, setFileToDelete] = useState<string | null>(null);

	const supabase = createClient();

	async function uploadFile(file: File) {
		setUploading(true);
		setMessage("");

		try {
			const optimized = await optimizeImage(file);

			const fileName = `${Date.now()}-${
				file.name
					.replace(/\.[^/.]+$/, "")
					.toLowerCase()
					.replace(/[^a-z0-9-_]+/g, "-")
					.replace(/^-+|-+$/g, "") || "image"
			}.webp`;

			const { error } = await supabase.storage.from("post-images").upload(fileName, optimized, {
				cacheControl: "31536000",
				upsert: false,
				contentType: "image/webp",
			});

			if (error) {
				setMessage(`Σφάλμα upload: ${error.message}`);
				return;
			}

			const { data: publicUrl } = supabase.storage.from("post-images").getPublicUrl(fileName);

			setFiles((current) => [
				{
					name: fileName,
					url: publicUrl.publicUrl,
					created_at: new Date().toISOString(),
					size: optimized.size,
					content_type: "image/webp",
				},
				...current,
			]);

			const originalMB = (file.size / 1024 / 1024).toFixed(2);

			const optimizedKB = Math.round(optimized.size / 1024);

			setMessage(`Η εικόνα ανέβηκε επιτυχώς: ${originalMB} MB → ${optimizedKB} KB.`);
		} catch (error) {
			setMessage(
				error instanceof Error
					? `Σφάλμα: ${error.message}`
					: "Σφάλμα κατά την επεξεργασία της εικόνας.",
			);
		} finally {
			setUploading(false);
		}
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

	async function copyUrl(url: string) {
		await navigator.clipboard.writeText(url);
		setMessage("Το URL αντιγράφηκε.");
	}

	return (
		<div>
			<div className="media-upload-card">
				<label className="media-upload-label">
					<span>{uploading ? "Ανέβασμα..." : "Ανέβασε εικόνα"}</span>

					<input
						type="file"
						accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
						disabled={uploading}
						onChange={(event) => {
							const file = event.target.files?.[0];

							if (file) {
								void uploadFile(file);
							}

							event.target.value = "";
						}}
					/>
				</label>

				<p>JPG, PNG, WebP, GIF ή AVIF.</p>
			</div>

			{message && <div className="notice success">{message}</div>}

			{files.length === 0 ? (
				<div className="form-card">
					<p>Δεν υπάρχουν εικόνες στο Media Library.</p>
				</div>
			) : (
				<div className="media-grid">
					{files.map((file) => (
						<article className="media-card" key={file.name}>
							<div className="media-preview">
								<Image src={file.url} alt={file.name} width={700} height={438} />
							</div>

							<div className="media-card-body">
								<strong title={file.name}>{file.name}</strong>

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
