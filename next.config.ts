import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

let supabaseHost = "";

try {
	supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
} catch {}

// Next.js injects small inline scripts, so script-src needs 'unsafe-inline'.
// Everything else (framing, plugins, base tag, form targets, origins) is locked down.
const csp = [
	"default-src 'self'",
	`script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob: https:",
	"font-src 'self' data:",
	`connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ""}${isDev ? " ws:" : ""}`,
	"worker-src 'self' blob:",
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"object-src 'none'",
	...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
	poweredByHeader: false,
	reactStrictMode: true,
	images: { unoptimized: true },
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{ key: "Content-Security-Policy", value: csp },
					{ key: "X-Frame-Options", value: "DENY" },
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
					{
						key: "Permissions-Policy",
						value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
					},
					{
						key: "Strict-Transport-Security",
						value: "max-age=31536000; includeSubDomains",
					},
				],
			},
			{
				// The service worker must always be re-checked, never served from the HTTP cache.
				source: "/sw.js",
				headers: [
					{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
					{ key: "Content-Type", value: "application/javascript; charset=utf-8" },
				],
			},
			{
				source: "/admin/:path*",
				headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
			},
		];
	},
};

export default nextConfig;
