import { createHash } from "node:crypto";
import { isSafeBannerUrl } from "@/lib/banner";
import { log, safeError } from "@/lib/log";
import { formatOutlookDate } from "@/lib/outlook/format";
import type { PushTopic } from "@/lib/push-topics";
import { SITE_URL } from "@/lib/site";
import { createServiceClient } from "@/lib/supabase/service";
import { type PushMessage, type PushSubscription, sendPush, vapidKeys } from "@/lib/webpush";

type Summary = {
	outlooks: number;
	posts: number;
	emergencies: number;
	delivered: number;
	removed: number;
	failed: number;
};

// Few at a time, and a pause between two different notifications: push services (FCM above
// all) answer 429 when they get a burst, and a refused notification would be lost.
const PARALLEL = 10;
const PAUSE_BETWEEN_NOTIFICATIONS_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Sends one message to every subscribed phone. Subscriptions the push service reports as gone
// (the phone unsubscribed or was reset) are deleted.
async function broadcast(topic: PushTopic, message: PushMessage, urgent: boolean) {
	const supabase = createServiceClient();
	let delivered = 0;
	let removed = 0;
	let failed = 0;
	let total = 0;
	const started = Date.now();

	// Only the phones that chose this topic. If the topics column does not exist yet (the SQL
	// was not run) everyone gets everything, as before.
	let byTopic = true;

	for (let from = 0; ; from += 1000) {
		let query = supabase.from("push_subscriptions").select("endpoint,p256dh,auth");

		if (byTopic) query = query.contains("topics", [topic]);

		let { data, error } = await query
			.order("created_at", { ascending: true })
			.range(from, from + 999);

		if (error && byTopic && (error.code === "42703" || error.code === "PGRST204")) {
			byTopic = false;
			log.warn("push.broadcast.topics_unavailable", { topic });

			({ data, error } = await supabase
				.from("push_subscriptions")
				.select("endpoint,p256dh,auth")
				.order("created_at", { ascending: true })
				.range(from, from + 999));
		}

		if (error) log.error("push.broadcast.read_failed", { error: safeError(error) });
		if (error || !data) break;

		for (let i = 0; i < data.length; i += PARALLEL) {
			const batch = data.slice(i, i + PARALLEL) as PushSubscription[];
			const results = await Promise.all(batch.map((sub) => sendPush(sub, message, { urgent })));
			const gone = batch
				.filter((_, index) => results[index] === "gone")
				.map((sub) => sub.endpoint);

			delivered += results.filter((result) => result === "sent").length;
			failed += results.filter((result) => result === "failed").length;
			total += batch.length;

			if (gone.length > 0) {
				removed += gone.length;
				await supabase.from("push_subscriptions").delete().in("endpoint", gone);
			}
		}

		if (data.length < 1000) break;
	}

	// "delivered" means the push service ACCEPTED the message. Whether the phone then shows it
	// depends on the phone (battery saver, notifications switched off, the site open on screen).
	log[failed > 0 ? "warn" : "info"]("push.broadcast", {
		topic,
		tag: message.tag,
		urgent,
		total,
		accepted: delivered,
		gone: removed,
		failed,
		ms: Date.now() - started,
	});

	return { delivered, removed, failed, total };
}

export const emergencyKey = (url: string) => createHash("md5").update(url).digest("hex");

// Looks for things that went live and have not been announced yet, and announces each once:
//   - a map that is published and whose issue time has come
//   - an active banner with the emergency bulletin on (a new address counts as new)
// Each item is claimed in the database before sending, so two runs at the same moment (the
// save in the admin and the scheduled check) can never send it twice.
export async function sendPendingNotifications(): Promise<Summary | { configured: false }> {
	if (!vapidKeys()) return { configured: false };

	const supabase = createServiceClient();
	const now = new Date().toISOString();
	const summary: Summary = {
		outlooks: 0,
		posts: 0,
		emergencies: 0,
		delivered: 0,
		removed: 0,
		failed: 0,
	};

	const { data: outlooks } = await supabase
		.from("outlooks")
		.select("id,title,slug,issued_at")
		.eq("published", true)
		.not("published_at", "is", null)
		.lte("published_at", now)
		.lte("issued_at", now)
		.is("push_sent_at", null)
		.order("issued_at", { ascending: true })
		.limit(5);

	for (const outlook of outlooks ?? []) {
		const { data: claimed } = await supabase
			.from("outlooks")
			.update({ push_sent_at: now })
			.eq("id", outlook.id)
			.is("push_sent_at", null)
			.select("id");

		if (!claimed?.length) continue;

		const result = await broadcast(
			"maps",
			{
				title: "🗺️ Νέος χάρτης πρόγνωσης",
				body: `${outlook.title}\n${formatOutlookDate(outlook.issued_at)}`,
				url: `/outlooks/${outlook.slug}`,
				tag: `outlook-${outlook.id}`,
				image: `${SITE_URL}/outlooks/${outlook.slug}/opengraph-image`,
			},
			false,
		);

		// every phone failed (the push service was down, say): hand the map back so the next
		// scheduled check tries again instead of losing the announcement
		if (result.total > 0 && result.delivered === 0 && result.failed === result.total) {
			await supabase.from("outlooks").update({ push_sent_at: null }).eq("id", outlook.id);
			log.error("push.released", { kind: "outlook", id: outlook.id, failed: result.failed });
			continue;
		}

		summary.outlooks += 1;
		summary.delivered += result.delivered;
		summary.removed += result.removed;
		summary.failed += result.failed;

		await sleep(PAUSE_BETWEEN_NOTIFICATIONS_MS);
	}

	const { data: banners } = await supabase
		.from("weather_banner")
		.select("id,title,emergency_url,push_emergency_key")
		.eq("emergency_enabled", true)
		.not("emergency_url", "is", null)
		.or(`starts_at.is.null,starts_at.lte.${now}`)
		.or(`ends_at.is.null,ends_at.gt.${now}`)
		.limit(5);

	for (const banner of banners ?? []) {
		const url = banner.emergency_url as string | null;

		if (!url || !isSafeBannerUrl(url)) continue;

		const key = emergencyKey(url);

		if (banner.push_emergency_key === key) continue;

		let claim = supabase
			.from("weather_banner")
			.update({ push_emergency_key: key })
			.eq("id", banner.id);

		claim = banner.push_emergency_key
			? claim.eq("push_emergency_key", banner.push_emergency_key)
			: claim.is("push_emergency_key", null);

		const { data: claimed } = await claim.select("id");

		if (!claimed?.length) continue;

		const result = await broadcast(
			"banner",
			{
				title: "🚨 ΕΚΤΑΚΤΟ ΔΕΛΤΙΟ ΚΑΚΟΚΑΙΡΙΑΣ",
				// the banner's own headline, then what tapping does
				body: `${banner.title?.trim() || "Ισχυρά καιρικά φαινόμενα σε εξέλιξη"}\nΠάτα για να δεις το δελτίο.`,
				url,
				// the key changes with every new bulletin, so a second bulletin does not
				// silently replace the first one on the phone
				tag: `emergency-${key.slice(0, 12)}`,
				urgent: true,
			},
			true,
		);

		if (result.total > 0 && result.delivered === 0 && result.failed === result.total) {
			await supabase
				.from("weather_banner")
				.update({ push_emergency_key: banner.push_emergency_key })
				.eq("id", banner.id);
			log.error("push.released", { kind: "banner", id: banner.id, failed: result.failed });
			continue;
		}

		summary.emergencies += 1;
		summary.delivered += result.delivered;
		summary.removed += result.removed;
		summary.failed += result.failed;

		await sleep(PAUSE_BETWEEN_NOTIFICATIONS_MS);
	}

	// Articles: published, their time has come, and not announced yet. (Articles that were
	// already live when the column was added are marked as announced by the SQL.)
	const { data: posts, error: postsError } = await supabase
		.from("posts")
		.select("id,title,slug,description,image_url,published_at")
		.eq("published", true)
		.not("published_at", "is", null)
		.lte("published_at", now)
		.is("push_sent_at", null)
		.order("published_at", { ascending: true })
		.limit(5);

	if (postsError) {
		// 42703: push_sent_at does not exist yet (supabase/changes-2026-11-16.sql not run)
		log[postsError.code === "42703" ? "warn" : "error"]("push.posts.read_failed", {
			error: safeError(postsError),
		});
	}

	for (const post of posts ?? []) {
		const { data: claimed } = await supabase
			.from("posts")
			.update({ push_sent_at: now })
			.eq("id", post.id)
			.is("push_sent_at", null)
			.select("id");

		if (!claimed?.length) continue;

		const cover = typeof post.image_url === "string" && /^https:\/\//.test(post.image_url);
		const result = await broadcast(
			"posts",
			{
				title: `📰 ${post.title}`.slice(0, 120),
				body: (post.description?.trim() || "Νέο άρθρο στο GreeceWeather").slice(0, 160),
				url: `/posts/${post.slug}`,
				tag: `post-${post.id}`,
				image: cover ? post.image_url : `${SITE_URL}/posts/${post.slug}/opengraph-image`,
			},
			false,
		);

		if (result.total > 0 && result.delivered === 0 && result.failed === result.total) {
			await supabase.from("posts").update({ push_sent_at: null }).eq("id", post.id);
			log.error("push.released", { kind: "post", id: post.id, failed: result.failed });
			continue;
		}

		summary.posts += 1;
		summary.delivered += result.delivered;
		summary.removed += result.removed;
		summary.failed += result.failed;

		await sleep(PAUSE_BETWEEN_NOTIFICATIONS_MS);
	}

	return summary;
}
