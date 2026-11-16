import { timingSafeEqual } from "node:crypto";
import { log, requestFields } from "@/lib/log";

// Scheduled jobs (nightly backup, notification check) call the site with
// "Authorization: Bearer <CRON_SECRET>". Without a long enough secret nothing is allowed.
export function isCronAuthorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

	if (!secret || secret.length < 16) {
		log.error("cron.secret_unusable", {
			...requestFields(request),
			reason: secret ? "shorter than 16 characters" : "CRON_SECRET is not set",
		});

		return false;
	}

	const a = Buffer.from(given);
	const b = Buffer.from(secret);
	const ok = a.length === b.length && timingSafeEqual(a, b);

	if (!ok) {
		log.warn("cron.unauthorized", {
			...requestFields(request),
			sentAuthorization: given.length > 0,
		});
	}

	return ok;
}
