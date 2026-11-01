import { createHash } from "node:crypto";
import { isSafeBannerUrl } from "@/lib/banner";
import { formatOutlookDate } from "@/lib/outlook/format";
import { createServiceClient } from "@/lib/supabase/service";
import { type PushMessage, type PushSubscription, sendPush, vapidKeys } from "@/lib/webpush";

type Summary = { outlooks: number; emergencies: number; delivered: number; removed: number };

const PARALLEL = 20;

// Sends one message to every subscribed phone. Subscriptions the push service reports as gone
// (the phone unsubscribed or was reset) are deleted.
async function broadcast(message: PushMessage, urgent: boolean) {
	const supabase = createServiceClient();
	let delivered = 0;
	let removed = 0;

	for (let from = 0; ; from += 1000) {
		const { data, error } = await supabase
			.from("push_subscriptions")
			.select("endpoint,p256dh,auth")
			.order("created_at", { ascending: true })
			.range(from, from + 999);

		if (error || !data) break;

		for (let i = 0; i < data.length; i += PARALLEL) {
			const batch = data.slice(i, i + PARALLEL) as PushSubscription[];
			const results = await Promise.all(batch.map((sub) => sendPush(sub, message, { urgent })));
			const gone = batch
				.filter((_, index) => results[index] === "gone")
				.map((sub) => sub.endpoint);

			delivered += results.filter((result) => result === "sent").length;

			if (gone.length > 0) {
				removed += gone.length;
				await supabase.from("push_subscriptions").delete().in("endpoint", gone);
			}
		}

		if (data.length < 1000) break;
	}

	return { delivered, removed };
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
	const summary: Summary = { outlooks: 0, emergencies: 0, delivered: 0, removed: 0 };

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
			{
				title: "Νέος χάρτης",
				body: `${outlook.title} · ${formatOutlookDate(outlook.issued_at)}`,
				url: `/outlooks/${outlook.slug}`,
				tag: `outlook-${outlook.id}`,
			},
			false,
		);

		summary.outlooks += 1;
		summary.delivered += result.delivered;
		summary.removed += result.removed;
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
			{
				title: "Έκτακτο δελτίο",
				body: banner.title?.trim() || "Ισχυρή κακοκαιρία σε εξέλιξη",
				url,
				tag: `emergency-${banner.id}`,
			},
			true,
		);

		summary.emergencies += 1;
		summary.delivered += result.delivered;
		summary.removed += result.removed;
	}

	return summary;
}
