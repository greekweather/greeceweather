import {
	createCipheriv,
	createECDH,
	createPrivateKey,
	hkdfSync,
	randomBytes,
	sign,
} from "node:crypto";

// Web Push without a library: the message is encrypted as in RFC 8291 (aes128gcm) and the
// request is signed as in RFC 8292 (VAPID). Only node:crypto is used.

export type PushSubscription = { endpoint: string; p256dh: string; auth: string };

export type PushMessage = { title: string; body: string; url: string; tag?: string };

const b64 = (data: Buffer | Uint8Array) => Buffer.from(data).toString("base64url");
const fromB64 = (text: string) => Buffer.from(text, "base64url");

/** Encrypts `payload` for one subscription. `fixed` is only for the RFC test vector. */
export function encryptPayload(
	payload: Buffer,
	subscription: { p256dh: string; auth: string },
	fixed?: { privateKey: Buffer; salt: Buffer },
): Buffer {
	const uaPublic = fromB64(subscription.p256dh);
	const authSecret = fromB64(subscription.auth);

	if (uaPublic.length !== 65 || uaPublic[0] !== 4 || authSecret.length !== 16) {
		throw new Error("Invalid subscription keys");
	}

	const ecdh = createECDH("prime256v1");

	if (fixed) ecdh.setPrivateKey(fixed.privateKey);
	else ecdh.generateKeys();

	const asPublic = ecdh.getPublicKey();
	const sharedSecret = ecdh.computeSecret(uaPublic);
	const salt = fixed?.salt ?? randomBytes(16);

	const ikm = Buffer.from(
		hkdfSync(
			"sha256",
			sharedSecret,
			authSecret,
			Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]),
			32,
		),
	);

	const cek = Buffer.from(
		hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16),
	);
	const nonce = Buffer.from(
		hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12),
	);

	// a single record: the text, then 0x02 ("last record") as the padding delimiter
	const cipher = createCipheriv("aes-128-gcm", cek, nonce);
	const encrypted = Buffer.concat([
		cipher.update(Buffer.concat([payload, Buffer.from([2])])),
		cipher.final(),
		cipher.getAuthTag(),
	]);

	const header = Buffer.alloc(21);
	salt.copy(header, 0);
	header.writeUInt32BE(4096, 16);
	header.writeUInt8(asPublic.length, 20);

	return Buffer.concat([header, asPublic, encrypted]);
}

/** The "Authorization" header that proves the message comes from this site (RFC 8292). */
export function vapidHeader(
	endpoint: string,
	keys: { publicKey: string; privateKey: string; subject: string },
	now = Date.now(),
): string {
	const publicKey = fromB64(keys.publicKey);

	const privateKey = createPrivateKey({
		key: {
			kty: "EC",
			crv: "P-256",
			d: keys.privateKey,
			x: b64(publicKey.subarray(1, 33)),
			y: b64(publicKey.subarray(33, 65)),
		},
		format: "jwk",
	});

	const header = b64(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
	const claims = b64(
		Buffer.from(
			JSON.stringify({
				aud: new URL(endpoint).origin,
				exp: Math.floor(now / 1000) + 12 * 3600,
				sub: keys.subject,
			}),
		),
	);

	const signature = sign("sha256", Buffer.from(`${header}.${claims}`), {
		key: privateKey,
		dsaEncoding: "ieee-p1363",
	});

	return `vapid t=${header}.${claims}.${b64(signature)}, k=${keys.publicKey}`;
}

export function vapidKeys() {
	const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
	const privateKey = process.env.VAPID_PRIVATE_KEY;

	if (!publicKey || !privateKey) return null;

	return {
		publicKey,
		privateKey,
		subject: process.env.VAPID_SUBJECT || "mailto:admin@greeceweather.gr",
	};
}

export type SendResult = "sent" | "gone" | "failed";

/** Sends one notification. "gone" means the phone unsubscribed: forget the subscription. */
export async function sendPush(
	subscription: PushSubscription,
	message: PushMessage,
	options: { urgent?: boolean } = {},
): Promise<SendResult> {
	const keys = vapidKeys();

	if (!keys) return "failed";

	try {
		const body = encryptPayload(Buffer.from(JSON.stringify(message)), subscription);

		const response = await fetch(subscription.endpoint, {
			method: "POST",
			headers: {
				Authorization: vapidHeader(subscription.endpoint, keys),
				"Content-Encoding": "aes128gcm",
				"Content-Type": "application/octet-stream",
				TTL: String(options.urgent ? 6 * 3600 : 24 * 3600),
				Urgency: options.urgent ? "high" : "normal",
			},
			body: new Uint8Array(body),
			signal: AbortSignal.timeout(10_000),
		});

		if (response.status === 404 || response.status === 410) return "gone";

		return response.ok ? "sent" : "failed";
	} catch {
		return "failed";
	}
}

// Only the push services of the browsers are accepted as an endpoint: otherwise anyone could
// make this server send requests to any address.
const PUSH_HOSTS = [
	/(^|\.)googleapis\.com$/, // Chrome, Edge, Opera, Samsung (fcm.googleapis.com)
	/(^|\.)push\.services\.mozilla\.com$/, // Firefox
	/(^|\.)push\.apple\.com$/, // Safari, iPhone web apps
	/(^|\.)notify\.windows\.com$/, // old Edge
];

export function isPushEndpoint(value: string): boolean {
	try {
		const url = new URL(value);

		return url.protocol === "https:" && PUSH_HOSTS.some((host) => host.test(url.hostname));
	} catch {
		return false;
	}
}
