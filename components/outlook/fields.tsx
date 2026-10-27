"use client";

import { useEffect, useId, useState } from "react";

function format(value: number, decimals: number) {
	return Number.isFinite(value) ? String(Number(value.toFixed(decimals))) : "";
}

/**
 * Number input that only reports valid values. While the visitor is typing it keeps
 * the raw text, so "99" on the way to "990" is never rejected half-way.
 */
export function NumberField({
	label,
	value,
	min,
	max,
	step = 1,
	decimals = 0,
	onCommit,
	suffix,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	decimals?: number;
	onCommit: (value: number) => void;
	suffix?: string;
}) {
	const id = useId();
	const [text, setText] = useState(format(value, decimals));
	const [focused, setFocused] = useState(false);

	useEffect(() => {
		if (!focused) setText(format(value, decimals));
	}, [value, decimals, focused]);

	const parsed = Number(text.replace(",", "."));
	const valid = text.trim() !== "" && Number.isFinite(parsed) && parsed >= min && parsed <= max;

	return (
		<div className="outlook-field">
			<label htmlFor={id}>{label}</label>
			<div className="outlook-field-row">
				<input
					id={id}
					type="number"
					inputMode="decimal"
					min={min}
					max={max}
					step="any"
					value={text}
					aria-invalid={!valid}
					onKeyDown={(event) => {
						// step="any" lets odd decimals through validation, so the arrows are handled here
						if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
						event.preventDefault();
						const base = Number.isFinite(parsed) ? parsed : value;
						const delta = event.key === "ArrowUp" ? step : -step;
						const next = Math.min(max, Math.max(min, Number((base + delta).toFixed(6))));
						setText(format(next, decimals));
						onCommit(next);
					}}
					onFocus={() => setFocused(true)}
					onBlur={() => {
						setFocused(false);
						setText(format(value, decimals));
					}}
					onChange={(event) => {
						const next = event.target.value;
						setText(next);
						const n = Number(next.replace(",", "."));
						if (next.trim() !== "" && Number.isFinite(n) && n >= min && n <= max) {
							onCommit(n);
						}
					}}
				/>
				{suffix && <span className="outlook-field-suffix">{suffix}</span>}
			</div>
		</div>
	);
}

export function TextField({
	label,
	value,
	maxLength,
	placeholder,
	onChange,
}: {
	label: string;
	value: string;
	maxLength: number;
	placeholder?: string;
	onChange: (value: string) => void;
}) {
	const id = useId();

	return (
		<div className="outlook-field">
			<label htmlFor={id}>{label}</label>
			<input
				id={id}
				type="text"
				value={value}
				maxLength={maxLength}
				placeholder={placeholder}
				onChange={(event) => onChange(event.target.value)}
			/>
		</div>
	);
}
