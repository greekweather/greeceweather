"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUpload } from "@/components/admin/ImageUpload";

export type FormPost = {
	id?: string;
	title: string;
	slug: string;
	description: string;
	content: string;
	image_url: string;
	image_alt: string;
	tag_ids: string[];
	published: boolean;
	published_at: string;
};

function countRenderedLines(element: HTMLElement) {
	const textNode = element.firstChild;

	if (!textNode || !textNode.textContent?.trim()) {
		return 0;
	}

	const range = document.createRange();
	const lineTops = new Set<number>();

	for (let i = 0; i < textNode.textContent.length; i++) {
		range.setStart(textNode, i);
		range.setEnd(textNode, i + 1);

		for (const rect of Array.from(range.getClientRects())) {
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
	const [title, setTitle] = useState(post?.title ?? "");
	const [description, setDescription] = useState(post?.description ?? "");
	const [titleTooLong, setTitleTooLong] = useState(false);
	const [descriptionTooLong, setDescriptionTooLong] = useState(false);

	const measureGridRef = useRef<HTMLDivElement>(null);
	const titleMeasureRef = useRef<HTMLHeadingElement>(null);
	const descriptionMeasureRef = useRef<HTMLParagraphElement>(null);

	useEffect(() => {
		const measureLines = () => {
			const titleElement = titleMeasureRef.current;
			const descriptionElement = descriptionMeasureRef.current;

			if (titleElement) {
				setTitleTooLong(countRenderedLines(titleElement) > 3);
			}

			if (descriptionElement) {
				setDescriptionTooLong(countRenderedLines(descriptionElement) > 3);
			}
		};

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
	}, [title, description]);

	return (
		<form action={action} className="form-card form-grid">
			{post?.id && <input type="hidden" name="id" value={post.id} />}

			<div className="form-row">
				<div className="form-field">
					<label htmlFor="title">Τίτλος *</label>

					<input
						id="title"
						name="title"
						required
						maxLength={180}
						value={title}
						onChange={(e) => setTitle(e.target.value)}
					/>

					{titleTooLong && (
						<p className="form-warning" role="status">
							⚠ Ο τίτλος ξεπερνά τις 3 γραμμές στην κάρτα άρθρου.
						</p>
					)}
				</div>

				<div className="form-field">
					<label htmlFor="slug">Slug *</label>

					<input
						id="slug"
						name="slug"
						required
						maxLength={120}
						pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
						defaultValue={post?.slug}
					/>
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

				{descriptionTooLong && (
					<p className="form-warning" role="status">
						⚠ Η περιγραφή ξεπερνά τις 3 γραμμές και θα εμφανιστεί
						κομμένη με «...».
					</p>
				)}
			</div>

			<div className="form-field">
				<label htmlFor="content">Άρθρο (Markdown)</label>

				<textarea
					id="content"
					name="content"
					required
					defaultValue={post?.content}
					style={{
						minHeight: 420,
						fontFamily: "ui-monospace,SFMono-Regular,Consolas,monospace",
					}}
				/>
			</div>

			<div className="form-row">
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
					<label htmlFor="image_alt">Image alt</label>

					<input
						id="image_alt"
						name="image_alt"
						maxLength={180}
						value={imageAlt}
						onChange={(e) => setImageAlt(e.target.value)}
					/>
				</div>
			</div>

			<ImageUpload
				onUploaded={(url, alt) => {
					setImageUrl(url);

					if (!imageAlt) {
						setImageAlt(alt);
					}
				}}
			/>

			<div className="form-field">
				<label>Ετικέτες</label>

				<div className="tag-selector">
					{availableTags.length > 0 ? (
						availableTags.map((tag) => (
							<label className="tag-option" key={tag.id}>
								<input
									type="checkbox"
									name="tag_ids"
									value={tag.id}
									defaultChecked={post?.tag_ids.includes(tag.id)}
								/>
								<span>{tag.name}</span>
							</label>
						))
					) : (
						<p>Δεν υπάρχουν διαθέσιμες ετικέτες.</p>
					)}
				</div>
			</div>

			<div className="form-row">
				<div className="form-field">
					<label htmlFor="published_at">
						Ημερομηνία/ώρα δημοσίευσης
					</label>

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
						/>
						<span>Δημοσιευμένο</span>
					</label>
				</div>
			</div>

			<div
				style={{
					display: "flex",
					gap: 10,
					flexWrap: "wrap",
				}}
			>
				<button className="button" type="submit">
					Αποθήκευση
				</button>

				<a className="button secondary" href="/admin">
					Ακύρωση
				</a>
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

							<p ref={descriptionMeasureRef}>
								{description || "\u00a0"}
							</p>
						</div>
					</article>
				</div>
			</div>

		</form>
	);
}
