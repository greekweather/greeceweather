import { log, safeError } from "@/lib/log";
import { createServiceClient } from "@/lib/supabase/service";

export type PushStats = {
	total: number;
	maps: number;
	posts: number;
	banner: number;
	/** false if supabase/changes-2026-11-16.sql has not been run: the split by topic is unknown */
	byTopic: boolean;
	/** set if the numbers could not be read at all */
	error?: string;
};

// How many devices have notifications on: all together and for each topic. Server-only (the
// subscriptions table is not readable with a visitor's or an admin's own key).
export async function getPushStats(): Promise<PushStats> {
	const empty = { total: 0, maps: 0, posts: 0, banner: 0, byTopic: true };

	try {
		const supabase = createServiceClient();
		const count = (topic?: string) => {
			const query = supabase
				.from("push_subscriptions")
				.select("*", { count: "exact", head: true });

			return topic ? query.contains("topics", [topic]) : query;
		};

		const [total, maps, posts, banner] = await Promise.all([
			count(),
			count("maps"),
			count("posts"),
			count("banner"),
		]);

		if (total.error) {
			log.error("admin.push_stats_failed", { error: safeError(total.error) });

			return { ...empty, error: "Δεν ήταν δυνατή η ανάγνωση των συσκευών." };
		}

		if (maps.error || posts.error || banner.error) {
			// no topics column yet: everyone gets everything
			return {
				total: total.count ?? 0,
				maps: total.count ?? 0,
				posts: total.count ?? 0,
				banner: total.count ?? 0,
				byTopic: false,
			};
		}

		return {
			total: total.count ?? 0,
			maps: maps.count ?? 0,
			posts: posts.count ?? 0,
			banner: banner.count ?? 0,
			byTopic: true,
		};
	} catch (error) {
		log.error("admin.push_stats_failed", { error: safeError(error) });

		return { ...empty, error: "Ο server δεν έχει ρυθμιστεί για να διαβάσει τις συσκευές." };
	}
}
