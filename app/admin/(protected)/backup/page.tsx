import { BackupRestore } from "@/components/admin/BackupRestore";

export default function BackupPage() {
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
				<div className="form-card backup-card">
					<h2>Λήψη αντιγράφου</h2>
					<p>
						Αποθηκεύει άρθρα, ετικέτες, χάρτες και μπάνερ σε ένα αρχείο JSON. Οι φωτογραφίες δεν
						περιλαμβάνονται: τα άρθρα κρατούν μόνο το link τους, οπότε μη σβήνεις εικόνες από τα
						Πολυμέσα αν θες να γυρίσεις άρθρα που τις χρησιμοποιούν.
					</p>

					<a className="button" href="/admin/backup/download" download>
						Λήψη αντιγράφου
					</a>
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
