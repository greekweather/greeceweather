"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { deletePostAction } from "@/app/actions";
import { DeleteConfirmButton } from "@/components/admin/DeleteConfirmButton";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { PostPreview } from "@/components/admin/PostPreview";
import { TagPicker } from "@/components/admin/TagPicker";
import { greeklishSlug, imageNameFromUrl } from "@/lib/slug";

type FormPost = {
	id?: string;
	title: string;
	slug: string;
	description: string;
	content: string;
	image_url: string;
	image_alt: string;
	image_caption?: string;
	tag_ids: string[];
	published: boolean;
	published_at: string;
};

type LocalCopy = {
	title: string;
	slug: string;
	description: string;
	content: string;
	image_url: string;
	image_alt: string;
	image_caption: string;
	tag_ids: string[];
	at: string;
};

function localKey(id: string | undefined) {
	return `greeceweather:post-draft:${id ?? "new"}`;
}

function countRenderedLines(element: HTMLElement) {
	const textNode = element.firstChild;

	if (!textNode?.textContent?.trim()) {
		return 0;
	}

	const range = document.createRange();
	range.selectNodeContents(textNode);

	const lineTops = new Set<number>();

	for (const rect of Array.from(range.getClientRects())) {
		if (rect.width > 0 && rect.height > 0) {
			lineTops.add(Math.round(rect.top));
		}
	}

	return lineTops.size;
}

export function PostForm({
	post,
	action,
	availableTags,
}: {
	post?: FormPost;
	action: (formData: FormData) => void | Promise<void>;
	availableTags: {
		id: string;
		name: string;
	}[];
}) {
	const [imageUrl, setImageUrl] = useState(post?.image_url ?? "");
	const [imageAlt, setImageAlt] = useState(post?.image_alt ?? "");
	const [imageCaption, setImageCaption] = useState(post?.image_caption ?? "");
	const [title, setTitle] = useState(post?.title ?? "");
	const [description, setDescription] = useState(post?.description ?? "");
	const [content, setContent] = useState(post?.content ?? "");
	const [slug, setSlug] = useState(post?.slug ?? "");
	const [selectedTagIds, setSelectedTagIds] = useState<string[]>(post?.tag_ids ?? []);

	const [titleTooLong, setTitleTooLong] = useState(false);
	const [descriptionTooLong, setDescriptionTooLong] = useState(false);
	const [slugIsInvalid, setSlugIsInvalid] = useState(false);
	const [publishAttempted, setPublishAttempted] = useState(false);
	const [showPreview, setShowPreview] = useState(false);
	const [draftId, setDraftId] = useState<string | null>(post?.id ?? null);
	const [published, setPublished] = useState(post?.published ?? false);
	const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
	const [recovered, setRecovered] = useState<LocalCopy | null>(null);

	const measureGridRef = useRef<HTMLDivElement>(null);
	const titleMeasureRef = useRef<HTMLHeadingElement>(null);
	const descriptionMeasureRef = useRef<HTMLParagraphElement>(null);

	const measureLines = useCallback(() => {
		const titleElement = titleMeasureRef.current;
		const descriptionElement = descriptionMeasureRef.current;

		if (titleElement) {
			setTitleTooLong(countRenderedLines(titleElement) > 3);
		}

		if (descriptionElement) {
			setDescriptionTooLong(countRenderedLines(descriptionElement) > 3);
		}
	}, []);

	// Measure again whenever the text changes. The resize observers below are not enough:
	// the real card clips the description at 3 lines, so its box stops growing and no
	// resize event arrives once the text goes past that.
	// biome-ignore lint/correctness/useExhaustiveDependencies: title and description are the triggers
	useEffect(() => {
		const frame = requestAnimationFrame(measureLines);

		return () => cancelAnimationFrame(frame);
	}, [title, description, measureLines]);

	useEffect(() => {
		const frame = requestAnimationFrame(measureLines);

		const resizeObserver = new ResizeObserver(() => {
			requestAnimationFrame(measureLines);
		});

		if (measureGridRef.current) {
			resizeObserver.observe(measureGridRef.current);
		}

		if (titleMeasureRef.current) {
			resizeObserver.observe(titleMeasureRef.current);
		}

		if (descriptionMeasureRef.current) {
			resizeObserver.observe(descriptionMeasureRef.current);
		}

		window.addEventListener("resize", measureLines);

		return () => {
			cancelAnimationFrame(frame);
			resizeObserver.disconnect();
			window.removeEventListener("resize", measureLines);
		};
	}, [measureLines]);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			setSlugIsInvalid(slug.trim().length > 0 && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug));
		}, 500);

		return () => window.clearTimeout(timer);
	}, [slug]);

	const snapshot = useCallback(
		() => ({
			title,
			slug,
			description,
			content,
			image_url: imageUrl,
			image_alt: imageAlt,
			image_caption: imageCaption,
			tag_ids: selectedTagIds,
		}),
		[title, slug, description, content, imageUrl, imageAlt, imageCaption, selectedTagIds],
	);

	const autoAltRef = useRef("");
	const initialRef = useRef(JSON.stringify(snapshot()));
	const lastSavedRef = useRef(initialRef.current);
	const draftIdRef = useRef(draftId);
	const submittingRef = useRef(false);
	const savingRef = useRef(false);
	const snapshotRef = useRef(snapshot);
	const saveNowRef = useRef<(keepalive?: boolean) => Promise<void>>(async () => {});

	snapshotRef.current = snapshot;

	draftIdRef.current = draftId;

	// Unpublished posts (and new ones) are saved to the server as a draft in the background.
	// A published post is never changed behind your back: its edits are kept only in this
	// browser, and offered back if you return without saving.
	const canAutosaveToServer = !published && !post?.published;

	const saveNow = useCallback(
		async (keepalive = false) => {
			const current = JSON.stringify(snapshot());

			if (current === lastSavedRef.current || submittingRef.current || savingRef.current) return;

			const data = snapshot();
			const empty = !data.title.trim() && !data.content.trim() && !data.description.trim();

			if (empty && !draftIdRef.current) return;

			savingRef.current = true;
			setSaveState("saving");

			try {
				const response = await fetch("/api/admin/post-autosave", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ id: draftIdRef.current, ...data }),
					keepalive,
				});

				if (!response.ok) throw new Error(String(response.status));

				const result = (await response.json()) as { id: string };

				lastSavedRef.current = current;
				setDraftId(result.id);
				draftIdRef.current = result.id;
				setSaveState("saved");
			} catch {
				setSaveState("error");
			} finally {
				savingRef.current = false;

				// typing went on while this save was running: save that too
				if (JSON.stringify(snapshotRef.current()) !== lastSavedRef.current) {
					window.setTimeout(() => void saveNowRef.current(), 300);
				}
			}
		},
		[snapshot],
	);

	saveNowRef.current = saveNow;

	const saveLocal = useCallback(() => {
		try {
			const current = JSON.stringify(snapshot());

			if (current === initialRef.current) {
				localStorage.removeItem(localKey(post?.id));
			} else {
				localStorage.setItem(
					localKey(post?.id),
					JSON.stringify({ ...snapshot(), at: new Date().toISOString() }),
				);
			}
		} catch {}
	}, [snapshot, post?.id]);

	// offer back edits of a published post that were never saved
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount
	useEffect(() => {
		if (!post?.published) return;

		try {
			const raw = localStorage.getItem(localKey(post.id));
			const stored = raw ? (JSON.parse(raw) as LocalCopy) : null;

			if (stored) {
				const { at: _at, ...rest } = stored;

				if (JSON.stringify(rest) !== initialRef.current) setRecovered(stored);
			}
		} catch {}
	}, []);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			if (canAutosaveToServer) {
				void saveNow();
			} else {
				saveLocal();
			}
		}, 500);

		return () => window.clearTimeout(timer);
	}, [canAutosaveToServer, saveNow, saveLocal]);

	const flushRef = useRef(() => {});

	flushRef.current = () => {
		if (submittingRef.current) return;

		if (canAutosaveToServer) {
			void saveNow(true);
		} else {
			saveLocal();
		}
	};

	useEffect(() => {
		const flush = () => flushRef.current();
		const onHide = () => {
			if (document.visibilityState === "hidden") flush();
		};

		document.addEventListener("visibilitychange", onHide);
		window.addEventListener("pagehide", flush);

		return () => {
			document.removeEventListener("visibilitychange", onHide);
			window.removeEventListener("pagehide", flush);
			// leaving through an in-app link, where the page is never unloaded
			flush();
		};
	}, []);

	const hasTitle = title.trim().length > 0;
	const hasDescription = description.trim().length > 0;
	const hasContent = content.trim().length > 0;
	const hasTags = selectedTagIds.length > 0;
	const hasImage = imageUrl.trim().length > 0;
	const hasSlug = slug.trim().length > 0;

	const previewTags = availableTags
		.filter((tag) => selectedTagIds.includes(tag.id))
		.map((tag) => tag.name)
		.sort((a, b) => a.localeCompare(b, "el"));

	const showTitleWarning = publishAttempted && !hasTitle;
	const showDescriptionWarning = publishAttempted && !hasDescription;
	const showContentWarning = publishAttempted && !hasContent;
	const showTagWarning = publishAttempted && !hasTags;
	const showImageWarning = publishAttempted && !hasImage;
	const showSlugWarning = publishAttempted && !hasSlug;

	return (
		<form
			id="post-form"
			action={action}
			className="form-card form-grid"
			onSubmit={(event) => {
				const form = event.currentTarget;
				const submitter = (event.nativeEvent as SubmitEvent).submitter;

				// deleting must not be blocked by the publish checks
				if (submitter?.hasAttribute("formaction")) {
					return;
				}

				// a background save still running could create a second copy of a new post
				if (savingRef.current) {
					event.preventDefault();
					window.setTimeout(() => form.requestSubmit(submitter as HTMLElement | null), 300);

					return;
				}

				const publishedInput = form.elements.namedItem("published");

				const willPublish = publishedInput instanceof HTMLInputElement && publishedInput.checked;

				if (willPublish) {
					setPublishAttempted(true);

					if (!hasTitle || !hasDescription || !hasContent || !hasSlug || !hasTags || !hasImage) {
						event.preventDefault();

						return;
					}
				}

				submittingRef.current = true;

				try {
					localStorage.removeItem(localKey(post?.id));
				} catch {}
			}}
		>
			{draftId && <input type="hidden" name="id" value={draftId} />}

			{recovered && (
				<div className="draft-recovery" role="status">
					<span>
						Βρέθηκαν μη αποθηκευμένες αλλαγές από{" "}
						{new Date(recovered.at).toLocaleString("el-GR", { timeZone: "Europe/Athens" })}.
					</span>

					<button
						type="button"
						className="button"
						onClick={() => {
							setTitle(recovered.title);
							setSlug(recovered.slug);
							setDescription(recovered.description);
							setContent(recovered.content);
							setImageUrl(recovered.image_url);
							setImageAlt(recovered.image_alt);
							setImageCaption(recovered.image_caption);
							setSelectedTagIds(recovered.tag_ids);
							setRecovered(null);
						}}
					>
						Επαναφορά
					</button>

					<button
						type="button"
						className="button secondary"
						onClick={() => {
							try {
								localStorage.removeItem(localKey(post?.id));
							} catch {}

							setRecovered(null);
						}}
					>
						Απόρριψη
					</button>
				</div>
			)}

			<div className="form-row">
				<div className="form-field">
					<label htmlFor="title">Τίτλος</label>

					<input
						id="title"
						name="title"
						maxLength={180}
						value={title}
						onChange={(e) => setTitle(e.target.value)}
					/>

					<p
						className={`form-warning-slot ${showTitleWarning || titleTooLong ? "visible" : ""}`}
						role="alert"
					>
						{showTitleWarning
							? "⚠ Για δημοσίευση πρέπει να υπάρχει τίτλος άρθρου."
							: "⚠ Ο τίτλος ξεπερνά τις 3 γραμμές στην κάρτα άρθρου."}
					</p>
				</div>

				<div className="form-field">
					<label htmlFor="slug">Slug</label>

					<div className="slug-field">
						<input
							id="slug"
							name="slug"
							maxLength={120}
							value={slug}
							onChange={(e) => setSlug(e.target.value)}
						/>

						<button
							type="button"
							className="button secondary slug-generate"
							disabled={!hasTitle}
							title={hasTitle ? "Δημιουργία slug από τον τίτλο" : "Γράψε πρώτα τίτλο"}
							onClick={() => setSlug(greeklishSlug(title, 120))}
						>
							Δημιουργία slug
						</button>
					</div>

					<p
						className={`form-warning-slot ${showSlugWarning || slugIsInvalid ? "visible" : ""}`}
						role="alert"
					>
						{showSlugWarning
							? "⚠ Για δημοσίευση πρέπει να υπάρχει slug άρθρου."
							: "⚠ Το slug πρέπει να περιέχει μόνο πεζά αγγλικά γράμματα, " +
								"αριθμούς και παύλες."}
					</p>
				</div>
			</div>

			<div className="form-field">
				<label htmlFor="description">Περιγραφή</label>

				<textarea
					id="description"
					name="description"
					maxLength={400}
					style={{ minHeight: 100 }}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
				/>

				<p
					className={`form-warning-slot ${
						showDescriptionWarning || descriptionTooLong ? "visible" : ""
					}`}
					role="alert"
				>
					{showDescriptionWarning
						? "⚠ Για δημοσίευση πρέπει να υπάρχει περιγραφή άρθρου."
						: "⚠ Η περιγραφή ξεπερνά τις 3 γραμμές και θα εμφανιστεί κομμένη με «...»."}
				</p>
			</div>

			<div className="form-field">
				<label htmlFor="content">Άρθρο (Markdown)</label>

				<textarea
					id="content"
					name="content"
					value={content}
					onChange={(e) => setContent(e.target.value)}
					style={{
						minHeight: 420,
						fontFamily: "ui-monospace,SFMono-Regular,Consolas,monospace",
					}}
				/>

				<p className={`form-warning-slot ${showContentWarning ? "visible" : ""}`} role="alert">
					⚠ Για δημοσίευση πρέπει να υπάρχει περιεχόμενο άρθρου.
				</p>
			</div>

			<div className="form-row image-fields">
				<div className="form-field">
					<label htmlFor="image_url">Image URL</label>

					<input
						id="image_url"
						name="image_url"
						value={imageUrl}
						onChange={(e) => setImageUrl(e.target.value)}
					/>
				</div>

				<div className="form-field">
					<label htmlFor="image_alt">Image Alt</label>

					<input
						id="image_alt"
						name="image_alt"
						maxLength={180}
						value={imageAlt}
						onChange={(e) => setImageAlt(e.target.value)}
					/>
				</div>
			</div>

			<div className="form-field">
				<label htmlFor="image_caption">Λεζάντα κύριας εικόνας (προαιρετικό)</label>

				<input
					id="image_caption"
					name="image_caption"
					maxLength={300}
					placeholder="π.χ. Δορυφορική εικόνα, 24/10 06:00 · Πηγή: ΕΜΥ"
					value={imageCaption}
					onChange={(e) => setImageCaption(e.target.value)}
				/>

				<small>
					Για εικόνες μέσα στο κείμενο βάλε τη λεζάντα σε εισαγωγικά μετά το link:{" "}
					<code>![alt](https://… "Λεζάντα")</code>
				</small>
			</div>

			<p className={`form-warning-slot ${showImageWarning ? "visible" : ""}`} role="alert">
				⚠ Για δημοσίευση πρέπει να υπάρχει εικόνα άρθρου.
			</p>

			<ImagePicker
				currentUrl={imageUrl}
				onSelect={(url) => {
					setImageUrl(url);

					// the alt text becomes the picture's own name (not its address); a name filled
					// in by an earlier pick is replaced, one you typed yourself is kept
					const name = imageNameFromUrl(url);

					if (name && (!imageAlt || imageAlt === autoAltRef.current)) {
						setImageAlt(name);
						autoAltRef.current = name;
					}
				}}
			/>

			<div className="form-field">
				<div className="form-label">Ετικέτες</div>

				<TagPicker
					tags={availableTags}
					selectedIds={selectedTagIds}
					onChange={setSelectedTagIds}
				/>

				<p className={`form-warning-slot ${showTagWarning ? "visible" : ""}`} role="alert">
					⚠ Για δημοσίευση πρέπει να επιλέξεις τουλάχιστον μία ετικέτα.
				</p>
			</div>

			<div className="form-row">
				<div className="form-field">
					<label htmlFor="published_at">Ημερομηνία/ώρα δημοσίευσης</label>

					<input
						id="published_at"
						name="published_at"
						type="datetime-local"
						defaultValue={post?.published_at}
					/>
				</div>

				<div className="form-field" style={{ alignSelf: "end" }}>
					<label className="publish-option">
						<input
							type="checkbox"
							name="published"
							defaultChecked={post?.published}
							onChange={(e) => {
								setPublished(e.target.checked);

								if (!e.target.checked) {
									setPublishAttempted(false);
								}
							}}
						/>
						<span>Δημοσιευμένο</span>
					</label>
				</div>
			</div>

			<div className="form-field">
				<div className="post-preview-head">
					<div className="form-label">Προεπισκόπηση</div>

					<button
						type="button"
						className="button secondary"
						aria-expanded={showPreview}
						onClick={() => setShowPreview((value) => !value)}
					>
						{showPreview ? "Απόκρυψη" : "Εμφάνιση προεπισκόπησης"}
					</button>
				</div>

				{showPreview && (
					<PostPreview
						title={title}
						description={description}
						content={content}
						imageUrl={imageUrl}
						imageAlt={imageAlt}
						imageCaption={imageCaption}
						tags={previewTags}
					/>
				)}
			</div>

			<div className="form-actions">
				<button className="button" type="submit">
					Αποθήκευση
				</button>

				<span className={`autosave-status ${saveState}`} aria-live="polite">
					{canAutosaveToServer
						? saveState === "saving"
							? "Αποθήκευση πρόχειρου…"
							: saveState === "saved"
								? "Το πρόχειρο αποθηκεύτηκε αυτόματα"
								: saveState === "error"
									? "Αποτυχία αυτόματης αποθήκευσης"
									: "Αυτόματη αποθήκευση πρόχειρου ενεργή"
						: "Δημοσιευμένο: οι αλλαγές κρατούνται τοπικά μέχρι να πατήσεις 'Αποθήκευση'."}
				</span>

				{draftId && (
					<DeleteConfirmButton
						id={draftId}
						name={title || post?.title || "Χωρίς τίτλο"}
						action={deletePostAction}
						itemType="άρθρου"
						grammar="το άρθρο"
						parentFormId="post-form"
					/>
				)}

				<Link className="button secondary" href="/admin/posts">
					Ακύρωση
				</Link>
			</div>

			<div
				ref={measureGridRef}
				aria-hidden="true"
				className="container"
				style={{
					position: "absolute",
					left: "-100000px",
					top: 0,
					visibility: "hidden",
					pointerEvents: "none",
				}}
			>
				<div className="post-grid">
					<article className="post-card">
						<div className="post-card-body">
							<h3 ref={titleMeasureRef}>{title || "\u00a0"}</h3>

							{/* The card clips this paragraph at 3 lines; measure it unclipped to count them. */}
							<p ref={descriptionMeasureRef} className="post-measure">
								{description || "\u00a0"}
							</p>
						</div>
					</article>
				</div>
			</div>
		</form>
	);
}
