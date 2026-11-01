"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

// "Οριστική διαγραφή" of a safety copy. Once it is gone there is nothing left to restore from,
// so the dialog says so plainly before anything happens.
export function PurgeConfirmButton({
	id,
	name,
	action,
}: {
	id: string;
	name: string;
	action: (formData: FormData) => void;
}) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button className="button secondary" type="button" onClick={() => setOpen(true)}>
				Οριστική διαγραφή
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
							<h2 id="purge-confirm-title">ΟΡΙΣΤΙΚΗ ΔΙΑΓΡΑΦΗ</h2>

							<p>
								Το αντίγραφο <strong className="delete-confirm-name">&ldquo;{name}&rdquo;</strong>{" "}
								θα σβηστεί για πάντα.
							</p>

							<p className="delete-confirm-warning">
								ΔΕΝ ΥΠΑΡΧΕΙ ΕΠΙΣΤΡΟΦΗ. Μετά από αυτό δεν θα μπορείς να επαναφέρεις το στοιχείο από
								πουθενά, εκτός αν έχεις κατεβάσει το ίδιο αντίγραφο σε αρχείο.
							</p>

							<div className="delete-confirm-actions">
								<button className="button secondary" type="button" onClick={() => setOpen(false)}>
									Όχι, κράτα το
								</button>

								<form action={action}>
									<input type="hidden" name="id" value={id} />

									<button className="button danger" type="submit">
										Ναι, διαγραφή για πάντα
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
