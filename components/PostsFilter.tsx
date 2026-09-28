"use client";

import { useEffect, useMemo, useState } from "react";

export function PostsFilter({ tags }: { tags: string[] }) {
	const [tag, setTag] = useState("all");
	const [sort, setSort] = useState("newest");
	const [search, setSearch] = useState("");
	const [appliedSearch, setAppliedSearch] = useState("");

	const tagOptions = useMemo(
		() => tags.map((x) => ({ label: x, value: x.toLocaleLowerCase("el-GR") })),
		[tags],
	);

	useEffect(() => {
		const timeout = window.setTimeout(() => {
			setAppliedSearch(search);
		}, 500);

		return () => window.clearTimeout(timeout);
	}, [search]);

	useEffect(() => {
		filterCards(tag, sort, appliedSearch);
	}, [tag, sort, appliedSearch]);

	return (
		<div className="article-filters">
			<label className="article-search">
				<span>Αναζήτηση άρθρων</span>
				<input
					type="search"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Αναζήτηση με βάση τον τίτλο..."
				/>
			</label>

			<label>
				<span>Ετικέτα</span>
				<select value={tag} onChange={(e) => setTag(e.target.value)}>
					<option value="all">Όλες οι ετικέτες</option>
					{tagOptions.map((t) => (
						<option key={t.value} value={t.value}>
							{t.label}
						</option>
					))}
				</select>
			</label>

			<label>
				<span>Ταξινόμηση</span>
				<select value={sort} onChange={(e) => setSort(e.target.value)}>
					<option value="newest">Νεότερα</option>
					<option value="popular">Δημοφιλέστερα</option>
				</select>
			</label>
		</div>
	);
}

function filterCards(tag: string, sort: string, search: string) {
	const grid = document.getElementById("articles-grid");
	if (!grid) return;

	const cards = Array.from(grid.children) as HTMLElement[];

	cards
		.sort((a, b) => {
			const da = Number(a.dataset.date || 0);
			const db = Number(b.dataset.date || 0);

			if (sort === "popular") {
				return Number(b.dataset.views || 0) - Number(a.dataset.views || 0);
			}

			return db - da;
		})
		.forEach((el) => {
			grid.appendChild(el);
		});

	const normalizedSearch = search
		.trim()
		.toLocaleLowerCase("el-GR")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "");

	cards.forEach((el) => {
		const tags = (el.dataset.tags || "").split("|").filter(Boolean);

		const title = (el.dataset.title || "")
			.toLocaleLowerCase("el-GR")
			.normalize("NFD")
			.replace(/\p{Diacritic}/gu, "");

		const matchesTag = tag === "all" || tags.includes(tag);
		const matchesSearch = !normalizedSearch || title.includes(normalizedSearch);

		el.hidden = !matchesTag || !matchesSearch;
	});
}
