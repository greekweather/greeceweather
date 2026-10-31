"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ArchiveItem = {
	id: string;
	title: string;
	slug: string;
	/** "YYYY-MM-DD" in Athens time. */
	dateKey: string;
	/** Display text, e.g. "Σάβ 24 Οκτ 2026, 03:00". */
	label: string;
};

// Lower-case and drop Greek accents so "Οκτ" finds "οκτ" and "εκδοση" finds "έκδοση".
function normalize(value: string) {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "");
}

const PAGE_SIZE = 5;
const MAX_VISIBLE = 10;

export function ArchiveSearch({ items, latestId }: { items: ArchiveItem[]; latestId: string }) {
	const [query, setQuery] = useState("");
	const [date, setDate] = useState("");
	const [visible, setVisible] = useState(PAGE_SIZE);

	const filtering = query.trim() !== "" || date !== "";

	const results = useMemo(() => {
		const needle = normalize(query.trim());

		return items.filter((item) => {
			// without a filter the newest one is already shown above the archive
			if (!filtering) return item.id !== latestId;
			if (date && item.dateKey !== date) return false;
			if (!needle) return true;
			const [y, m, d] = item.dateKey.split("-");
			return normalize(`${item.title} ${item.label} ${d}/${m}/${y} ${item.dateKey}`).includes(
				needle,
			);
		});
	}, [items, latestId, query, date, filtering]);

	return (
		<section aria-labelledby="archive-title" className="outlook-archive">
			<h2 id="archive-title">Αρχείο</h2>

			<div className="outlook-archive-search">
				<div className="outlook-archive-field">
					<label htmlFor="archive-query">Αναζήτηση με τίτλο ή ημερομηνία</label>
					<input
						id="archive-query"
						type="search"
						value={query}
						placeholder="π.χ. Οκτ 2026, 24/10, Named Storm…"
						onChange={(event) => {
							setQuery(event.target.value);
							setVisible(PAGE_SIZE);
						}}
					/>
				</div>

				<div className="outlook-archive-field">
					<label htmlFor="archive-date">Συγκεκριμένη ημερομηνία</label>
					<input
						id="archive-date"
						type="date"
						value={date}
						onChange={(event) => {
							setDate(event.target.value);
							setVisible(PAGE_SIZE);
						}}
					/>
				</div>

				{filtering && (
					<button
						type="button"
						className="button secondary"
						onClick={() => {
							setQuery("");
							setDate("");
							setVisible(PAGE_SIZE);
						}}
					>
						Καθαρισμός
					</button>
				)}
			</div>

			<p className="outlook-hint" aria-live="polite">
				{filtering
					? `${results.length} ${results.length === 1 ? "αποτέλεσμα" : "αποτελέσματα"}`
					: `${results.length} ${results.length === 1 ? "παλαιότερος χάρτης" : "παλαιότεροι χάρτες"}`}
				{results.length > visible && ` · εμφανίζονται οι ${visible} πιο πρόσφατοι`}
				{results.length > MAX_VISIBLE &&
					visible === MAX_VISIBLE &&
					" (για παλαιότερους ψάξε παραπάνω)"}
			</p>

			{results.length > 0 ? (
				<ul>
					{results.slice(0, visible).map((item) => (
						<li key={item.id}>
							<Link href={`/outlooks/${item.slug}`}>{item.title}</Link>
							<span className="post-meta"> · {item.label}</span>
						</li>
					))}
				</ul>
			) : (
				filtering && <p>Δεν βρέθηκε χάρτης με αυτά τα κριτήρια.</p>
			)}

			{(results.length > visible && visible < MAX_VISIBLE) || visible > PAGE_SIZE ? (
				<div className="outlook-archive-more">
					{results.length > visible && visible < MAX_VISIBLE && (
						<button
							type="button"
							className="button secondary"
							onClick={() => setVisible(MAX_VISIBLE)}
						>
							Εμφάνιση περισσότερων
						</button>
					)}

					{visible > PAGE_SIZE && (
						<button
							type="button"
							className="button secondary"
							onClick={() => setVisible(PAGE_SIZE)}
						>
							Απόκρυψη
						</button>
					)}
				</div>
			) : null}
		</section>
	);
}
