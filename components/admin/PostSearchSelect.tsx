"use client";

import { useState } from "react";

type PostOption = { id: string; title: string };

const MAX_RESULTS = 6;

// Lower-case, no accents, so "καυσωνας" finds "Καύσωνας".
function fold(text: string) {
	return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ς/g, "σ");
}

// Pick a post by typing part of its title: a short list of matches instead of one huge menu.
// Submits the chosen id in a hidden field, empty when nothing is chosen.
export function PostSearchSelect({
	name,
	posts,
	value,
	onChange,
}: {
	name: string;
	posts: PostOption[];
	value: string;
	onChange: (id: string) => void;
}) {
	const [query, setQuery] = useState("");
	const selected = posts.find((post) => post.id === value);

	const words = fold(query).split(/\s+/).filter(Boolean);
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
			<input type="hidden" name={name} value={value} />

			{selected ? (
				<div className="post-search-selected">
					<span>{selected.title || "(χωρίς τίτλο)"}</span>

					<button
						type="button"
						className="button secondary"
						onClick={() => {
							onChange("");
							setQuery("");
						}}
					>
						Αλλαγή
					</button>
				</div>
			) : (
				<>
					<input
						type="search"
						className="post-search-input"
						placeholder="Γράψε τον τίτλο του άρθρου…"
						aria-label="Αναζήτηση άρθρου πρόγνωσης"
						autoComplete="off"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>

					{words.length > 0 && (
						<ul className="post-search-results" aria-label="Αποτελέσματα">
							{matches.length === 0 && <li className="post-search-empty">Δεν βρέθηκε άρθρο.</li>}

							{matches.map((post) => (
								<li key={post.id}>
									<button
										type="button"
										onClick={() => {
											onChange(post.id);
											setQuery("");
										}}
									>
										{post.title || "(χωρίς τίτλο)"}
									</button>
								</li>
							))}
						</ul>
					)}
				</>
			)}
		</div>
	);
}
