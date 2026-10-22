"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Tag = { id: string; name: string };

function normalize(value: string) {
	return value
		.toLocaleLowerCase("el-GR")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.trim();
}

export function TagPicker({
	tags,
	selectedIds,
	onChange,
}: {
	tags: Tag[];
	selectedIds: string[];
	onChange: (ids: string[]) => void;
}) {
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);

	const rootRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const byId = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);

	const selectedTags = selectedIds
		.map((id) => byId.get(id))
		.filter((tag): tag is Tag => tag !== undefined);

	const remaining = useMemo(() => {
		const q = normalize(query);

		return tags.filter(
			(tag) => !selectedIds.includes(tag.id) && (!q || normalize(tag.name).includes(q)),
		);
	}, [tags, selectedIds, query]);

	useEffect(() => {
		if (!open) return;

		function handleMouseDown(event: MouseEvent) {
			if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
				setOpen(false);
			}
		}

		document.addEventListener("mousedown", handleMouseDown);
		return () => document.removeEventListener("mousedown", handleMouseDown);
	}, [open]);

	function add(id: string) {
		onChange([...selectedIds, id]);
		setQuery("");
		setActive(0);
		inputRef.current?.focus();
	}

	function remove(id: string) {
		onChange(selectedIds.filter((current) => current !== id));
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setOpen(true);
			setActive((current) => Math.min(current + 1, Math.max(remaining.length - 1, 0)));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActive((current) => Math.max(current - 1, 0));
		} else if (event.key === "Enter") {
			// Never submit the post form from this field.
			event.preventDefault();
			const tag = remaining[active];
			if (open && tag) add(tag.id);
		} else if (event.key === "Escape") {
			setOpen(false);
		} else if (event.key === "Backspace" && query === "" && selectedIds.length > 0) {
			remove(selectedIds[selectedIds.length - 1]);
		}
	}

	return (
		<div className="tag-picker" ref={rootRef}>
			{selectedIds.map((id) => (
				<input key={id} type="hidden" name="tag_ids" value={id} />
			))}

			<div className="tag-picker-anchor">
				<div className="tag-picker-box">
					{selectedTags.map((tag) => (
						<span className="tag-chip" key={tag.id}>
							{tag.name}

							<button
								type="button"
								className="tag-chip-remove"
								aria-label={`Αφαίρεση ετικέτας ${tag.name}`}
								onClick={() => remove(tag.id)}
							>
								×
							</button>
						</span>
					))}

					<input
						ref={inputRef}
						className="tag-picker-input"
						type="text"
						value={query}
						placeholder={selectedTags.length ? "Προσθήκη…" : "Αναζήτηση και επιλογή ετικετών…"}
						aria-label="Αναζήτηση ετικέτας"
						autoComplete="off"
						onFocus={() => setOpen(true)}
						onClick={() => setOpen(true)}
						onChange={(event) => {
							setQuery(event.target.value);
							setActive(0);
							setOpen(true);
						}}
						onKeyDown={handleKeyDown}
					/>
				</div>

				<div className={`tag-picker-menu ${open ? "open" : ""}`}>
					{tags.length === 0 ? (
						<p className="tag-picker-empty">Δεν υπάρχουν διαθέσιμες ετικέτες.</p>
					) : remaining.length === 0 ? (
						<p className="tag-picker-empty">
							{query ? "Δεν βρέθηκε ετικέτα." : "Όλες οι ετικέτες έχουν επιλεγεί."}
						</p>
					) : (
						remaining.map((tag, index) => (
							<button
								key={tag.id}
								type="button"
								className={index === active ? "active" : ""}
								onMouseEnter={() => setActive(index)}
								onClick={() => add(tag.id)}
							>
								{tag.name}
							</button>
						))
					)}
				</div>
			</div>

			<small className="tag-picker-count">
				{selectedIds.length === 0 ? "Καμία ετικέτα" : `Επιλεγμένες: ${selectedIds.length}`}
			</small>
		</div>
	);
}
