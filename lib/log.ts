// Structured logging for the server. One JSON line per event, so the Vercel log search can
// filter on any field (event, route, status, requestId…).
//
// Secrets must never reach a log. Two layers protect against it:
//   1. fields whose NAME looks sensitive (key, secret, token, password, cookie, authorization…)
//      are replaced as a whole
//   2. every text is scanned for values that LOOK like a secret (JWTs, sb_secret_ keys, long
//      hex or base64 strings, bearer tokens, VAPID headers, e-mail addresses) and those parts
//      are replaced, wherever they appear, including inside error messages
// Raw error objects are never logged: use safeError(), which keeps the name, a cleaned message,
// the code and the status, and drops the stack's contents from third-party messages.

type Level = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEY = new RegExp(
	"(pass(word)?|secret|token|authorization|cookie|api[-_]?key|service[-_]?role|private|p256dh|" +
		"credential|session|jwt|signature|\\bauth\\b|\\bkey\\b)",
	"i",
);

const PATTERNS: [RegExp, string][] = [
	[/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[jwt]"],
	[/sb_(secret|publishable)_[A-Za-z0-9_-]+/g, "[supabase-key]"],
	[/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [redacted]"],
	[/vapid\s+t=[^\s,]+(,\s*k=[^\s,]+)?/gi, "vapid [redacted]"],
	[/\b[A-Za-z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD)[A-Za-z0-9_]*=[^\s"'\\]+/g, "[env-assignment]"],
	[/\b[a-f0-9]{32,}\b/gi, "[hex]"],
	[/\b[A-Za-z0-9_-]{40,}\b/g, "[long-token]"],
	[/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
];

const MAX_TEXT = 400;
const MAX_DEPTH = 4;

export function redactText(text: string): string {
	let out = text;

	for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);

	out = out.replace(/\s*\n\s*/g, " ⏎ ");

	return out.length > MAX_TEXT ? `${out.slice(0, MAX_TEXT)}…` : out;
}

function clean(value: unknown, depth = 0): unknown {
	if (value === null || value === undefined) return value;
	if (typeof value === "string") return redactText(value);
	if (typeof value === "number" || typeof value === "boolean") return value;
	if (value instanceof Error) return safeError(value);
	if (depth >= MAX_DEPTH) return "[deep]";

	if (Array.isArray(value)) return value.slice(0, 20).map((item) => clean(item, depth + 1));

	if (typeof value === "object") {
		const out: Record<string, unknown> = {};

		for (const [key, item] of Object.entries(value).slice(0, 40)) {
			out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : clean(item, depth + 1);
		}

		return out;
	}

	return String(typeof value);
}

/** What is safe to keep of an error: its kind, a cleaned message, a code and a status. */
export function safeError(error: unknown) {
	if (!(error instanceof Error) && typeof error !== "object") {
		return { message: redactText(String(error)) };
	}

	const e = (error ?? {}) as { name?: string; message?: string; code?: unknown; status?: unknown };

	return {
		name: typeof e.name === "string" ? e.name : "Error",
		message: redactText(typeof e.message === "string" ? e.message : "unknown"),
		...(e.code !== undefined && e.code !== "" ? { code: String(e.code).slice(0, 40) } : {}),
		...(typeof e.status === "number" ? { status: e.status } : {}),
	};
}

/** Only the host of an address: push endpoints and URLs carry secrets in their path. */
export function hostOf(address: string | null | undefined): string {
	try {
		return new URL(address ?? "").host;
	} catch {
		return "invalid";
	}
}

/** The caller's address, shortened so it identifies an area but not a household. */
export function clientIp(request: Request): string {
	const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";

	if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}::/48`;

	return ip ? `${ip.split(".").slice(0, 3).join(".")}.0/24` : "unknown";
}

/** What identifies a request in the logs, without anything private. */
export function requestFields(request: Request) {
	let path = "";

	try {
		path = new URL(request.url).pathname;
	} catch {}

	return {
		requestId: request.headers.get("x-vercel-id") ?? undefined,
		method: request.method,
		path,
		ip: clientIp(request),
	};
}

function write(level: Level, event: string, fields: Record<string, unknown> = {}) {
	const line = JSON.stringify({
		time: new Date().toISOString(),
		level,
		event,
		...(clean(fields) as Record<string, unknown>),
	});

	if (level === "error") console.error(line);
	else if (level === "warn") console.warn(line);
	else console.log(line);
}

export const log = {
	debug: (event: string, fields?: Record<string, unknown>) => {
		if (process.env.NODE_ENV !== "production") write("debug", event, fields);
	},
	info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
	warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
	error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};

/** Times a piece of work: const done = timer(); … done() -> milliseconds. */
export function timer() {
	const start = Date.now();

	return () => Date.now() - start;
}
