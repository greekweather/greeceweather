import { timingSafeEqual } from "node:crypto";

// Scheduled jobs (nightly backup, notification check) call the site with
// "Authorization: Bearer <CRON_SECRET>". Without a long enough secret nothing is allowed.
export function isCronAuthorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

	if (!secret || secret.length < 16) return false;

	const a = Buffer.from(given);
	const b = Buffer.from(secret);

	return a.length === b.length && timingSafeEqual(a, b);
}
