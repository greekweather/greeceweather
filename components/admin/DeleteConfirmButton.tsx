"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

export function DeleteConfirmButton({
	id,
	name,
	action,
	itemType,
	grammar,
	parentFormId,
}: {
	id: string;
	name: string;
	action: (formData: FormData) => void;
	itemType: "άρθρου" | "ετικέτας" | "μπάνερ" | "χάρτη";
	grammar: "το άρθρο" | "την ετικέτα" | "το μπάνερ" | "τον χάρτη";
	/** Id of the form to submit instead of a small form of its own (the form already holds the id). */
	parentFormId?: string;
}) {
	const [showConfirm, setShowConfirm] = useState(false);

	return (
		<>
			<button className="button danger" type="button" onClick={() => setShowConfirm(true)}>
				Διαγραφή
			</button>

			{showConfirm &&
				createPortal(
					<div className="delete-confirm-overlay">
						<div
							className="delete-confirm-dialog"
							role="dialog"
							aria-modal="true"
							aria-labelledby="delete-confirm-title"
						>
							<h2 id="delete-confirm-title">Διαγραφή {itemType}</h2>

							<p>
								Είσαι σίγουρος ότι θέλεις να διαγράψεις {grammar}{" "}
								<strong className="delete-confirm-name">&ldquo;{name}&rdquo;</strong>
							</p>

							<p className="delete-confirm-warning">Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.</p>

							<div className="delete-confirm-actions">
								<button
									className="button secondary"
									type="button"
									onClick={() => setShowConfirm(false)}
								>
									Ακύρωση
								</button>

								{parentFormId ? (
									<button
										className="button danger"
										type="submit"
										form={parentFormId}
										formAction={action}
									>
										Διαγραφή
									</button>
								) : (
									<form action={action}>
										<input type="hidden" name="id" value={id} />

										<button className="button danger" type="submit">
											Διαγραφή
										</button>
									</form>
								)}
							</div>
						</div>
					</div>,
					document.body,
				)}
		</>
	);
}
