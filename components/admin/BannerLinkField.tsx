"use client";

import { useState } from "react";
import { fold } from "@/components/admin/PostSearchSelect";

type PostOption = { id: string; title: string; slug: string };

const MAX_RESULTS = 6;

// One field for a banner button's link: paste any https:// address, or just type part of an
// article's title and pick it from the list, which fills in the article's address.
export function BannerLinkField({
	name,
	posts,
	siteUrl,
	defaultValue,
	describedBy,
}: {
	name: string;
	posts: PostOption[];
	siteUrl: string;
	defaultValue: string;
	describedBy?: string;
}) {
	const [value, setValue] = useState(defaultValue);
	const [open, setOpen] = useState(false);

	const isLink = /^https?:\/\//i.test(value.trim());
	const words = isLink ? [] : fold(value).split(/\s+/).filter(Boolean);
	const matches =
		words.length === 0
			? []
			: posts
					.filter((post) => {
						const title = fold(post.title || "");

						return words.every((word) => title.includes(word));
					})
					.slice(0, MAX_RESULTS);

	return (
		<div className="post-search">
			<input
				name={name}
				type="text"
				inputMode="url"
				autoComplete="off"
				placeholder="https://… ή γράψε τον τίτλο ενός άρθρου"
				aria-describedby={describedBy}
				value={value}
				onChange={(event) => {
					setValue(event.target.value);
					setOpen(true);
				}}
			/>

			{open && words.length > 0 && (
				<ul className="post-search-results" aria-label="Άρθρα">
					{matches.length === 0 && <li className="post-search-empty">Δεν βρέθηκε άρθρο.</li>}

					{matches.map((post) => (
						<li key={post.id}>
							<button
								type="button"
								onClick={() => {
									setValue(`${siteUrl.replace(/\/+$/, "")}/posts/${post.slug}`);
									setOpen(false);
								}}
							>
								{post.title || "(χωρίς τίτλο)"}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
