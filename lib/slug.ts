const LETTERS: Record<string, string> = {
	α: "a",
	β: "b",
	γ: "g",
	δ: "d",
	ε: "e",
	ζ: "z",
	η: "h",
	θ: "th",
	ι: "i",
	κ: "k",
	λ: "l",
	μ: "m",
	ν: "n",
	ξ: "ks",
	ο: "o",
	π: "p",
	ρ: "r",
	σ: "s",
	ς: "s",
	τ: "t",
	υ: "y",
	φ: "f",
	χ: "x",
	ψ: "ps",
	ω: "w",
};

// "Ισχυρή κακοκαιρία την Τετάρτη 4/11" -> "isxyrh-kakokairia-thn-tetarth-4-11".
// Accents are dropped, ου becomes "ou", every run of anything else becomes one dash.
export function greeklishSlug(text: string, maxLength = 100): string {
	const plain = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ου/g, "ou");

	let out = "";

	for (const char of plain) {
		out += LETTERS[char] ?? char;
	}

	return out
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, maxLength)
		.replace(/-+$/g, "");
}

// A file name from the visitor's computer made safe for storage keys: Greek letters become
// Latin ones, accents go, everything unusual becomes "-". Case and "_" are kept, so
// "IMG_2031 Αιγαίο.jpg" -> "IMG_2031-aigaio".
export function storageFileBase(fileName: string): string {
	const base = fileName.replace(/\.[^./\\]+$/, "");
	const plain = base.normalize("NFD").replace(/[̀-ͯ]/g, "");
	let out = "";

	for (const char of plain) {
		const lower = char.toLowerCase();
		const mapped = LETTERS[lower];

		out += mapped ? (lower === char ? mapped : mapped.toUpperCase()) : char;
	}

	return (
		out
			.replace(/[^A-Za-z0-9_-]+/g, "-")
			.replace(/-+/g, "-")
			.replace(/^[-_]+|[-_]+$/g, "")
			.slice(0, 80) || "image"
	);
}
