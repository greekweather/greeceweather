"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
	return (
		<section className="section">
			<div className="container">
				<h1>Κάτι πήγε στραβά</h1>
				<p>Δεν ήταν δυνατή η φόρτωση της σελίδας. Δοκίμασε ξανά σε λίγο.</p>

				<button className="button" type="button" onClick={reset}>
					Δοκιμή ξανά
				</button>
			</div>
		</section>
	);
}
