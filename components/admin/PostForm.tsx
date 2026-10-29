"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { deletePostAction } from "@/app/actions";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { PostPreview } from "@/components/admin/PostPreview";
import { TagPicker } from "@/components/admin/TagPicker";

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
			action={action}
			className="form-card form-grid"
			onSubmit={(event) => {
				const form = event.currentTarget;
				const publishedInput = form.elements.namedItem("published");

				const published = publishedInput instanceof HTMLInputElement && publishedInput.checked;

				if (!published) {
					return;
				}

				setPublishAttempted(true);

				if (!hasTitle || !hasDescription || !hasContent || !hasSlug || !hasTags || !hasImage) {
					event.preventDefault();
				}
			}}
		>
			{post?.id && <input type="hidden" name="id" value={post.id} />}

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

					<input
						id="slug"
						name="slug"
						maxLength={120}
						value={slug}
						onChange={(e) => setSlug(e.target.value)}
					/>

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
				onSelect={(url, alt) => {
					setImageUrl(url);

					if (!imageAlt && alt) {
						setImageAlt(alt);
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

				{post?.id && (
					<button className="button danger" type="submit" formAction={deletePostAction}>
						Διαγραφή
					</button>
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
