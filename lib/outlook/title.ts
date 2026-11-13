// How the title of the finished graphic is sized. The header has room for about 880 px of text
// (the "ΑΝΕΠΙΣΗΜΟ" box and the dates sit on the right). A normal title is drawn at TITLE_BASE;
// a long one shrinks down to TITLE_MIN; beyond that it would run into the box on the right.

export const TITLE_BASE = 18;
export const TITLE_MIN = 13;
const TITLE_ROOM = 880;
// average width of a bold Greek or Latin letter, as a share of the font size
const CHAR_WIDTH = 0.6;

export const TITLE_FIT_CHARS = Math.floor(TITLE_ROOM / (TITLE_BASE * CHAR_WIDTH));
export const TITLE_MAX_CHARS = Math.floor(TITLE_ROOM / (TITLE_MIN * CHAR_WIDTH));

export function titleFit(title: string): {
	fontSize: number;
	shrunk: boolean;
	tooLong: boolean;
} {
	const length = Math.max(1, title.trim().length);
	const needed = length * CHAR_WIDTH * TITLE_BASE;
	const fontSize =
		needed <= TITLE_ROOM ? TITLE_BASE : Math.max(TITLE_MIN, TITLE_ROOM / (length * CHAR_WIDTH));

	return {
		fontSize: Math.round(fontSize * 10) / 10,
		shrunk: fontSize < TITLE_BASE,
		tooLong: length > TITLE_MAX_CHARS,
	};
}
