"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { count, pick } from "@/lib/plural";

// "Οριστική διαγραφή" of a safety copy. Once it is gone there is nothing left to restore from,
// so the dialog says so plainly before anything happens.
export function PurgeConfirmButton({
	id,
	name,
	action,
	label = "Οριστική διαγραφή",
	all,
	restore = false,
}: {
	id?: string;
	name?: string;
	action: (formData: FormData) => void;
	label?: string;
	/** how many copies a "delete all" removes; shown in the warning */
	all?: number;
	/** the same dialog for "restore all": a plain question, not a permanent-deletion warning */
	restore?: boolean;
}) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button className="button secondary" type="button" onClick={() => setOpen(true)}>
				{label}
			</button>

			{open &&
				createPortal(
					<div className="delete-confirm-overlay">
						<div
							className="delete-confirm-dialog"
							role="alertdialog"
							aria-modal="true"
							aria-labelledby="purge-confirm-title"
						>
							<h2 id="purge-confirm-title">{restore ? "ΕΠΑΝΑΦΟΡΑ ΟΛΩΝ" : "ΟΡΙΣΤΙΚΗ ΔΙΑΓΡΑΦΗ"}</h2>

							{restore ? (
								<p>
									{pick(all ?? 0, "Θα επανέλθει", "Θα επανέλθουν")}{" "}
									<strong className="delete-confirm-name">
										{count(all ?? 0, "στοιχείο", "στοιχεία")}
									</strong>{" "}
									με τη σειρά, από το παλαιότερο. Όσα έχουν slug που υπάρχει ήδη θα παραλειφθούν
									και θα μείνουν στη λίστα.
								</p>
							) : all !== undefined ? (
								<p>
									<strong className="delete-confirm-name">
										{count(all, "αντίγραφο", "αντίγραφα")}
									</strong>{" "}
									{pick(all, "θα σβηστεί", "θα σβηστούν")} για πάντα.
								</p>
							) : (
								<p>
									Το αντίγραφο{" "}
									<strong className="delete-confirm-name">&ldquo;{name}&rdquo;</strong> θα σβηστεί
									για πάντα.
								</p>
							)}

							{!restore && (
								<p className="delete-confirm-warning">
									ΔΕΝ ΥΠΑΡΧΕΙ ΕΠΙΣΤΡΟΦΗ. Μετά από αυτό δεν θα μπορείς να επαναφέρεις το στοιχείο
									από πουθενά, εκτός αν έχεις κατεβάσει το ίδιο αντίγραφο σε αρχείο.
								</p>
							)}

							<div className="delete-confirm-actions">
								<button className="button secondary" type="button" onClick={() => setOpen(false)}>
									{restore ? "Άκυρο" : "Όχι, κράτα το"}
								</button>

								<form action={action}>
									{id && <input type="hidden" name="id" value={id} />}

									<button className={`button ${restore ? "" : "danger"}`} type="submit">
										{restore ? "Ναι, επαναφορά όλων" : "Ναι, διαγραφή για πάντα"}
									</button>
								</form>
							</div>
						</div>
					</div>,
					document.body,
				)}
		</>
	);
}
