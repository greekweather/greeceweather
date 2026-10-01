"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const categoryOptions = [
	{ label: "Όλα", value: "all", tags: [] },
	{ label: "Προγνώσεις", value: "forecasts", tags: ["προγνώσεις"] },
	{ label: "Αναλύσεις", value: "analysis", tags: ["αναλύσεις"] },
	{
		label: "Μεσοπρόθεσμες & Μακροπρόθεσμες Τάσεις",
		value: "trends",
		tags: ["μεσοπρόθεσμες εκτιμήσεις", "μακροπρόθεσμες εκτιμήσεις"],
	},
];

const sortOptions = [
	{ label: "Νεότερα", value: "newest" },
	{ label: "Παλαιότερα", value: "oldest" },
	{ label: "Δημοφιλέστερα", value: "popular" },
];

type OpenDropdown = "tag" | "sort" | null;

export function PostsFilter({ tags }: { tags: string[] }) {
	const [category, setCategory] = useState("all");
	const [tag, setTag] = useState("all");
	const [sort, setSort] = useState("newest");
	const [search, setSearch] = useState("");
	const [appliedSearch, setAppliedSearch] = useState("");
	const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);

	const filterRef = useRef<HTMLDivElement>(null);

	const tagOptions = useMemo(
		() =>
			tags.map((x) => ({
				label: x,
				value: x.toLocaleLowerCase("el-GR"),
			})),
		[tags],
	);

	useEffect(() => {
		const timeout = window.setTimeout(() => {
			setAppliedSearch(search);
		}, 500);

		return () => window.clearTimeout(timeout);
	}, [search]);

	useEffect(() => {
		filterCards(category, tag, sort, appliedSearch);
	}, [category, tag, sort, appliedSearch]);

	useEffect(() => {
		if (!openDropdown) return;

		function handleClickOutside(event: MouseEvent) {
			const target = event.target as Node;

			if (filterRef.current && !filterRef.current.contains(target)) {
				setOpenDropdown(null);
			}
		}

		function handleScroll() {
			setOpenDropdown(null);
		}

		document.addEventListener("mousedown", handleClickOutside);
		window.addEventListener("scroll", handleScroll, {
			passive: true,
		});

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			window.removeEventListener("scroll", handleScroll);
		};
	}, [openDropdown]);

	const selectedTagLabel =
		tag === "all"
			? "Όλες οι ετικέτες"
			: tagOptions.find((option) => option.value === tag)?.label || "Όλες οι ετικέτες";

	const selectedSortLabel =
		sortOptions.find((option) => option.value === sort)?.label || "Νεότερα";

	return (
		<>
			<div className="post-categories" role="tablist" aria-label="Κατηγορίες άρθρων">
				{categoryOptions.map((option) => (
					<button
						key={option.value}
						type="button"
						className={category === option.value ? "active" : ""}
						onClick={() => setCategory(option.value)}
					>
						{option.label}
					</button>
				))}
			</div>

			<div className="article-filters" ref={filterRef}>
				<label className="article-search">
					<span>Αναζήτηση άρθρων</span>

					<input
						type="search"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Αναζήτηση με βάση τον τίτλο..."
					/>
				</label>

				<div className="tag-filter">
					<span>Ετικέτα</span>

					<button
						type="button"
						className="tag-dropdown-trigger"
						aria-expanded={openDropdown === "tag"}
						onClick={() => setOpenDropdown((current) => (current === "tag" ? null : "tag"))}
					>
						<span>{selectedTagLabel}</span>

						<span
							className={`tag-dropdown-arrow ${openDropdown === "tag" ? "open" : ""}`}
							aria-hidden="true"
						>
							⌄
						</span>
					</button>

					<div className={`tag-dropdown-menu ${openDropdown === "tag" ? "open" : ""}`}>
						<button
							type="button"
							className={tag === "all" ? "active" : ""}
							onClick={() => {
								setTag("all");
								setOpenDropdown(null);
							}}
						>
							Όλες οι ετικέτες
						</button>

						{tagOptions.map((option) => (
							<button
								key={option.value}
								type="button"
								className={tag === option.value ? "active" : ""}
								onClick={() => {
									setTag(option.value);
									setOpenDropdown(null);
								}}
							>
								{option.label}
							</button>
						))}
					</div>
				</div>

				<div className="tag-filter">
					<span>Ταξινόμηση</span>

					<button
						type="button"
						className="tag-dropdown-trigger"
						aria-expanded={openDropdown === "sort"}
						onClick={() => setOpenDropdown((current) => (current === "sort" ? null : "sort"))}
					>
						<span>{selectedSortLabel}</span>

						<span
							className={`tag-dropdown-arrow ${openDropdown === "sort" ? "open" : ""}`}
							aria-hidden="true"
						>
							⌄
						</span>
					</button>

					<div className={`tag-dropdown-menu ${openDropdown === "sort" ? "open" : ""}`}>
						{sortOptions.map((option) => (
							<button
								key={option.value}
								type="button"
								className={sort === option.value ? "active" : ""}
								onClick={() => {
									setSort(option.value);
									setOpenDropdown(null);
								}}
							>
								{option.label}
							</button>
						))}
					</div>
				</div>
			</div>
		</>
	);
}

function filterCards(category: string, tag: string, sort: string, search: string) {
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

			if (sort === "oldest") {
				return da - db;
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

	const selectedCategory = categoryOptions.find((option) => option.value === category);

	const categoryTags = selectedCategory?.tags.map((x) => x.toLocaleLowerCase("el-GR")) ?? [];

	cards.forEach((el) => {
		const tags = (el.dataset.tags || "")
			.split("|")
			.filter(Boolean)
			.map((x) => x.trim().toLocaleLowerCase("el-GR"));

		const title = (el.dataset.title || "")
			.toLocaleLowerCase("el-GR")
			.normalize("NFD")
			.replace(/\p{Diacritic}/gu, "");

		const matchesCategory =
			category === "all" || categoryTags.some((categoryTag) => tags.includes(categoryTag));

		const matchesTag = tag === "all" || tags.includes(tag);

		const matchesSearch = !normalizedSearch || title.includes(normalizedSearch);

		el.hidden = !matchesCategory || !matchesTag || !matchesSearch;
	});
}
