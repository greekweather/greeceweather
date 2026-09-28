export default function MapsPage() {
	return (
		<>
			<section className="page-header">
				<div className="container">
					<p className="eyebrow">ΜΕΤΕΩΡΟΛΟΓΙΚΟΙ ΧΑΡΤΕΣ</p>
					<h1>Χάρτες</h1>
					<p>
						Ο υπάρχων χάρτης του GreeceWeather μπορεί να μεταφερθεί εδώ χωρίς να αλλάξει η υπόλοιπη
						αρχιτεκτονική.
					</p>
				</div>
			</section>
			<section className="section">
				<div className="container form-card">
					<p>
						Το migration πακέτο κρατά τον χάρτη απομονωμένο από το CMS. Αυτό αποτρέπει τον editor
						από το να έχει οποιαδήποτε πρόσβαση στους map scripts.
					</p>
					<p>
						Αν ο τρέχων <code>static/js/weather-map.js</code> και το map markup μεταφερθούν στο{" "}
						<code>public/</code>, μπορούν να συνδεθούν στο component χωρίς αλλαγές στη βάση.
					</p>
				</div>
			</section>
		</>
	);
}
