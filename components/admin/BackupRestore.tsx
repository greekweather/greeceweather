"use client";

import { useState } from "react";
import {
	BACKUP_LABELS,
	BACKUP_TABLES,
	type BackupFile,
	parseBackup,
	type RestoreMode,
} from "@/lib/backup";

const BATCH_BYTES = 1_500_000;
const BATCH_ROWS = 100;

type Result = { table: string; done: number; failed: number; error?: string };

// Splits rows into requests small enough for the server (posts can be large).
function batches(rows: Record<string, unknown>[]) {
	const out: Record<string, unknown>[][] = [];
	let current: Record<string, unknown>[] = [];
	let size = 0;

	for (const row of rows) {
		const rowSize = JSON.stringify(row).length;

		if (current.length > 0 && (size + rowSize > BATCH_BYTES || current.length >= BATCH_ROWS)) {
			out.push(current);
			current = [];
			size = 0;
		}

		current.push(row);
		size += rowSize;
	}

	if (current.length > 0) out.push(current);

	return out;
}

export function BackupRestore() {
	const [backup, setBackup] = useState<BackupFile | null>(null);
	const [fileError, setFileError] = useState("");
	const [mode, setMode] = useState<RestoreMode>("missing");
	const [busy, setBusy] = useState(false);
	const [results, setResults] = useState<Result[]>([]);

	async function pick(event: React.ChangeEvent<HTMLInputElement>) {
		setBackup(null);
		setResults([]);
		setFileError("");

		const file = event.target.files?.[0];

		if (!file) return;

		try {
			const parsed = parseBackup(JSON.parse(await file.text()));

			if (!parsed) throw new Error("format");

			setBackup(parsed);
		} catch {
			setFileError("Το αρχείο δεν είναι έγκυρο αντίγραφο ασφαλείας του GreeceWeather.");
		}
	}

	async function restore() {
		if (!backup) return;

		setBusy(true);
		setResults([]);

		for (const table of BACKUP_TABLES) {
			const result: Result = { table, done: 0, failed: 0 };

			for (const rows of batches(backup.tables[table])) {
				try {
					const response = await fetch("/admin/backup/restore", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ table, mode, rows }),
					});
					const body = await response.json().catch(() => ({}));

					if (response.ok) {
						result.done += rows.length;
					} else {
						result.failed += rows.length;
						result.error ??= body.error ?? `Σφάλμα ${response.status}`;
					}
				} catch {
					result.failed += rows.length;
					result.error ??= "Δεν ήταν δυνατή η επικοινωνία με τον server.";
				}
			}

			setResults((current) => [...current, result]);
		}

		setBusy(false);
	}

	return (
		<div className="backup-restore">
			<div className="form-field">
				<label htmlFor="backup-file">Αρχείο αντιγράφου (.json)</label>
				<input id="backup-file" type="file" accept="application/json,.json" onChange={pick} />
			</div>

			{fileError && (
				<p className="form-warning" role="alert">
					{fileError}
				</p>
			)}

			{backup && (
				<>
					<p className="backup-summary">
						Αντίγραφο από {new Date(backup.created_at).toLocaleString("el-GR")}:{" "}
						{BACKUP_TABLES.map(
							(table) => `${BACKUP_LABELS[table]} ${backup.tables[table].length}`,
						).join(" · ")}
					</p>

					<fieldset className="backup-mode">
						<legend>Τρόπος επαναφοράς</legend>

						<label>
							<input
								type="radio"
								name="mode"
								checked={mode === "missing"}
								onChange={() => setMode("missing")}
							/>
							<span>
								<strong>Μόνο όσα λείπουν (ασφαλές)</strong>
								<small>Προστίθενται όσα έχουν σβηστεί. Ό,τι υπάρχει δεν αλλάζει.</small>
							</span>
						</label>

						<label>
							<input
								type="radio"
								name="mode"
								checked={mode === "overwrite"}
								onChange={() => setMode("overwrite")}
							/>
							<span>
								<strong>Αντικατάσταση όσων υπάρχουν</strong>
								<small>Ό,τι έχει το ίδιο id γυρίζει στην έκδοση του αντιγράφου.</small>
							</span>
						</label>
					</fieldset>

					<button type="button" className="button" onClick={restore} disabled={busy}>
						{busy ? "Επαναφορά…" : "Επαναφορά"}
					</button>
				</>
			)}

			{results.length > 0 && (
				<ul className="backup-results" aria-live="polite">
					{results.map((result) => (
						<li key={result.table} className={result.failed > 0 ? "failed" : ""}>
							<strong>{BACKUP_LABELS[result.table as keyof typeof BACKUP_LABELS]}:</strong>{" "}
							{result.done} εντάξει
							{result.failed > 0 && `, ${result.failed} απέτυχαν (${result.error})`}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
