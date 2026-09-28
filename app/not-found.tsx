import Link from "next/link";

export default function NotFound() {
	return (
		<section className="section">
			<div className="container form-card">
				<p className="eyebrow">404</p>
				<h1>Η σελίδα δεν βρέθηκε</h1>
				<p>Ο σύνδεσμος ίσως είναι παλιός ή το άρθρο δεν είναι πλέον δημοσιευμένο.</p>
				<Link className="button" href="/">
					Επιστροφή στην αρχική
				</Link>
			</div>
		</section>
	);
}
