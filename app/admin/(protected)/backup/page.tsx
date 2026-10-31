import { purgeDeletedAction, restoreDeletedAction } from "@/app/backup-actions";
import { BackupRestore } from "@/components/admin/BackupRestore";
import { Pagination } from "@/components/admin/Pagination";
import { paginate } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { TRASH_KIND_LABEL, type TrashKind } from "@/lib/trash";

function formatDateTime(value: string) {
	return new Intl.DateTimeFormat("el-GR", {
		dateStyle: "short",
		timeStyle: "short",
		timeZone: "Europe/Athens",
	}).format(new Date(value));
}

export default async function BackupPage({
	searchParams,
}: {
	searchParams: Promise<{ page?: string; restored?: string }>;
}) {
	const { page, restored } = await searchParams;

	const supabase = await createClient();

	const { data, error } = await supabase
		.from("deleted_items")
		.select("id,kind,label,created_at")
		.order("created_at", { ascending: false });

	const pager = paginate(data ?? [], page);

	return (
		<>
			<header className="admin-page-header">
				<div>
					<p className="eyebrow">ΣΥΣΤΗΜΑ</p>
					<h1>Αντίγραφα ασφαλείας</h1>
					<p>Λήψη όλου του περιεχομένου σε αρχείο και επαναφορά του αν κάτι σβηστεί.</p>
				</div>
			</header>

			<section className="admin-section">
				{restored && <p className="backup-notice">Το στοιχείο επανήλθε.</p>}

				<div className="form-card backup-card">
					<h2>Πρόσφατες διαγραφές</h2>
					<p>
						Κάθε φορά που σβήνεις άρθρο, ετικέτα, χάρτη ή μπάνερ, κρατιέται αυτόματα ένα αντίγραφο
						για 90 ημέρες. Από εδώ το επαναφέρεις όπως ήταν, μαζί με τις ετικέτες του.
					</p>

					{error ? (
						<p className="form-warning" role="alert">
							Δεν ήταν δυνατή η ανάγνωση των αντιγράφων ({error.message}). Έχεις τρέξει το
							supabase/changes-2026-10-31.sql;
						</p>
					) : pager.total === 0 ? (
						<p className="backup-summary">Δεν υπάρχουν διαγραμμένα στοιχεία.</p>
					) : (
						<div className="admin-table-wrap">
							<table className="admin-table">
								<thead>
									<tr>
										<th>Στοιχείο</th>
										<th>Είδος</th>
										<th>Διαγράφηκε</th>
										<th></th>
									</tr>
								</thead>

								<tbody>
									{pager.items.map((item) => (
										<tr key={item.id}>
											<td>
												<strong>
													{item.label || <span className="empty-value">(χωρίς όνομα)</span>}
												</strong>
											</td>
											<td data-label="Είδος">{TRASH_KIND_LABEL[item.kind as TrashKind]}</td>
											<td data-label="Διαγράφηκε">{formatDateTime(item.created_at)}</td>
											<td>
												<form action={restoreDeletedAction}>
													<input type="hidden" name="id" value={item.id} />
													<button className="button secondary" type="submit">
														Επαναφορά
													</button>
												</form>

												<form action={purgeDeletedAction}>
													<input type="hidden" name="id" value={item.id} />
													<button className="button secondary" type="submit">
														Οριστική διαγραφή
													</button>
												</form>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}

					{!error && <Pagination {...pager} href={(n) => `/admin/backup?page=${n}`} />}
				</div>

				<div className="form-card backup-card">
					<h2>Λήψη αντιγράφου</h2>
					<p>
						Αποθηκεύει άρθρα, ετικέτες, χάρτες και μπάνερ σε ένα αρχείο JSON. Οι φωτογραφίες δεν
						περιλαμβάνονται: τα άρθρα κρατούν μόνο το link τους, οπότε μη σβήνεις εικόνες από τα
						Πολυμέσα αν θες να γυρίσεις άρθρα που τις χρησιμοποιούν.
					</p>

					<div className="backup-downloads">
						<a className="button" href="/admin/backup/download" download>
							Λήψη αντιγράφου
						</a>

						<a className="button secondary" href="/admin/backup/download?full=1" download>
							Πλήρες αντίγραφο
						</a>
					</div>

					<p className="backup-summary">
						Το πλήρες προσθέτει τα αντίγραφα των διαγραμμένων και μια λίστα με τις φωτογραφίες που
						έχουν ανέβει. Δεν περιέχει λογαριασμούς χρηστών, τα ίδια τα αρχεία των εικόνων, ούτε τη
						δομή και τα δικαιώματα της βάσης (αυτά τα καλύπτουν τα αυτόματα backups του Supabase
						και το supabase/schema.sql).
					</p>
				</div>

				<div className="form-card backup-card">
					<h2>Επαναφορά</h2>
					<p>
						Διάλεξε ένα αρχείο που κατέβασες από εδώ. Το αντίγραφο διαβάζεται στον browser σου και
						στέλνεται στον server κομμάτι κομμάτι.
					</p>

					<BackupRestore />
				</div>
			</section>
		</>
	);
}
