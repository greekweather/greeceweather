// Whether a published item is already visible to visitors (not a draft, not scheduled for later).
export function isLive(published: boolean, publishedAt: string | null, issuedAt?: string | null) {
	if (!published || !publishedAt) return false;

	const now = Date.now();

	return Date.parse(publishedAt) <= now && (!issuedAt || Date.parse(issuedAt) <= now);
}
