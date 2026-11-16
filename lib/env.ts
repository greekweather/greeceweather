// Reading secrets from the environment, with checks that say WHAT is wrong without ever
// showing the value. The most common mistake is pasting two lines of a .env file into one
// variable; the value then contains a line break and every request that uses it fails.

export class EnvError extends Error {
	constructor(
		readonly variable: string,
		readonly problem: "missing" | "whitespace" | "shape",
	) {
		super(
			problem === "missing"
				? `${variable} is not set`
				: problem === "whitespace"
					? `${variable} contains a space or a line break (two lines pasted into one value?)`
					: `${variable} does not look like the expected kind of key`,
		);
		this.name = "EnvError";
	}
}

/** The value of a server-side variable. Throws an EnvError (never including the value). */
export function requireEnv(
	name: string,
	options: { shape?: RegExp; allowTrailingNewline?: boolean } = {},
): string {
	const raw = process.env[name];

	if (!raw) throw new EnvError(name, "missing");

	const value = options.allowTrailingNewline ? raw.trim() : raw;

	if (/\s/.test(value)) throw new EnvError(name, "whitespace");
	if (options.shape && !options.shape.test(value)) throw new EnvError(name, "shape");

	return value;
}

// A Supabase key is either a JWT (the old service_role / anon keys) or sb_secret_… /
// sb_publishable_… (the new ones).
export const SUPABASE_KEY_SHAPE = /^(eyJ[\w-]+\.[\w-]+\.[\w-]+|sb_(secret|publishable)_[\w-]+)$/;
