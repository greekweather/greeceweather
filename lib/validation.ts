import { z } from "zod";

const slugSchema = z
	.string()
	.trim()
	.max(120)
	.refine(
		(value) =>
			value === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
		"Το slug πρέπει να περιέχει μόνο πεζά λατινικά, αριθμούς και παύλες.",
	);

export const postInputSchema = z.object({
	title: z.string().trim().max(180),
	slug: slugSchema,
	description: z.string().trim().max(400).default(""),
	content: z.string().max(500_000),
	image_url: z
		.union([
			z
				.string()
				.trim()
				.regex(/^(https:\/\/|\/)/),
			z.literal(""),
		])
		.default(""),
	image_alt: z.string().trim().max(180).default(""),
	tags: z.string().trim().max(500).default(""),
	published: z.coerce.boolean().default(false),
	published_at: z.string().trim().optional().default(""),
});

export function normalizePublishedAt(raw: string, published: boolean) {
	if (!published) return null;
	if (!raw) return new Date().toISOString();

	const value = new Date(raw);

	if (Number.isNaN(value.getTime())) {
		throw new Error("Μη έγκυρη ημερομηνία δημοσίευσης.");
	}

	return value.toISOString();
}
