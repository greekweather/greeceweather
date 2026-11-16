// Runs before every build (npm run build -> prebuild). Stops the deploy BEFORE it goes live if an
// environment variable is set up in a way that would leak a secret or break every request.
// It prints the NAME of the variable and the problem, never the value.
//
//   - a server-side secret that contains a space or a line break (two lines of a .env file pasted
//     into one value)
//   - a NEXT_PUBLIC_ variable (it is sent to every visitor's browser) that holds a service-role or
//     secret key
//   - a Supabase key that is not shaped like one

const problems = [];

const SERVER = [
	"SUPABASE_SERVICE_ROLE_KEY",
	"CRON_SECRET",
	"VAPID_PRIVATE_KEY",
	"VAPID_SUBJECT",
	"NEXT_PUBLIC_SUPABASE_URL",
	"NEXT_PUBLIC_SUPABASE_ANON_KEY",
	"NEXT_PUBLIC_VAPID_PUBLIC_KEY",
];

for (const name of SERVER) {
	const value = process.env[name];

	if (value === undefined || value === "") continue;

	if (/\s/.test(value.trim())) {
		problems.push(`${name} contains a space or a line break (pasted two lines into one value?)`);
	}
}

const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (key && !/^(eyJ[\w-]+\.[\w-]+\.[\w-]+|sb_secret_[\w-]+)$/.test(key.trim())) {
	problems.push("SUPABASE_SERVICE_ROLE_KEY does not look like a Supabase secret key");
}

function jwtRole(token) {
	try {
		const payload = token.split(".")[1];

		return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role;
	} catch {
		return null;
	}
}

for (const [name, value] of Object.entries(process.env)) {
	if (!name.startsWith("NEXT_PUBLIC_") || !value) continue;

	if (value.startsWith("sb_secret_") || jwtRole(value) === "service_role") {
		problems.push(`${name} holds a SECRET key, but NEXT_PUBLIC_ variables go to every visitor`);
	}

	if (/(SECRET|PRIVATE|SERVICE_ROLE|PASSWORD)/i.test(name)) {
		problems.push(`${name} has "secret" in its name, but NEXT_PUBLIC_ variables are public`);
	}
}

if (problems.length > 0) {
	console.error("\nEnvironment check failed:");
	for (const problem of problems) console.error(`  - ${problem}`);
	console.error(
		"\nFix the variables in Vercel (Settings -> Environment Variables) and redeploy.\n",
	);
	process.exit(1);
}

console.log("Environment check passed.");
