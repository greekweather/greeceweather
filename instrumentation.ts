import { log, safeError } from "@/lib/log";

// Every error that escapes a page, a route or a server action ends up here. It is written as one
// cleaned log line (message with secrets removed, where it happened) instead of whatever the
// failing library chose to print, which is how a key once ended up in the logs.
export function onRequestError(
	error: unknown,
	request: { path: string; method: string },
	context: { routerKind: string; routePath: string; routeType: string; renderSource?: string },
) {
	const digest =
		typeof error === "object" && error && "digest" in error
			? String((error as { digest: unknown }).digest)
			: undefined;

	log.error("request.error", {
		method: request.method,
		path: request.path.split("?")[0],
		route: context.routePath,
		routeType: context.routeType,
		renderSource: context.renderSource,
		digest,
		error: safeError(error),
	});
}
