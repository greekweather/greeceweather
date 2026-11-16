// What a visitor can choose to be notified about. Shared by the browser and the server.
export const PUSH_TOPICS = ["maps", "posts", "banner"] as const;

export type PushTopic = (typeof PUSH_TOPICS)[number];

export const TOPIC_LABELS: Record<PushTopic, { title: string; hint: string }> = {
	maps: { title: "Χάρτες", hint: "Όταν βγαίνει νέος χάρτης πρόγνωσης" },
	posts: { title: "Άρθρα", hint: "Όταν δημοσιεύεται νέο άρθρο" },
	banner: { title: "Έκτακτα δελτία", hint: "Για επικίνδυνα φαινόμενα και προειδοποιήσεις" },
};

/** Keeps only known topics, once each, in the usual order. */
export function parseTopics(value: unknown): PushTopic[] {
	if (!Array.isArray(value)) return [];

	return PUSH_TOPICS.filter((topic) => value.includes(topic));
}
