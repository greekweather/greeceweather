/** "1 άρθρο" / "3 άρθρα": the number with the matching word. */
export function count(n: number, one: string, many: string): string {
	return `${n} ${n === 1 ? one : many}`;
}

/** Picks the matching form of a verb or noun phrase for a number. */
export function pick(n: number, one: string, many: string): string {
	return n === 1 ? one : many;
}
