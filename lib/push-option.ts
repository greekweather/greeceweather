// The "send a notification" tick of a form, as the column to save. When the announcement has
// already gone out the form carries "push_sent" instead of the tick, and nothing is changed.
export function readPushOption(formData: FormData): { push_enabled?: boolean } {
	if (formData.get("push_sent") === "1") return {};

	return { push_enabled: formData.get("push_enabled") === "on" };
}
