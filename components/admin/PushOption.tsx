// The "send a notification" setting of the article, map and banner forms, in two parts: the note
// that goes above "published" once the announcement has gone out, and the tick that goes below it
// until then (ticked by default). Once it has gone out there is nothing left to choose, and the
// hidden "push_sent" tells the save to leave the setting alone.
export function PushNote({ sent = false }: { sent?: boolean }) {
	if (!sent) return null;

	return (
		<>
			<input type="hidden" name="push_sent" value="1" />
			<small className="push-sent-note">
				🔔 Έχει ήδη ανακοινωθεί με ειδοποίηση, δεν θα σταλεί ξανά.
			</small>
		</>
	);
}

export function PushOption({
	enabled = true,
	sent = false,
	className,
	label = "Αποστολή ειδοποίησης",
	hint,
}: {
	enabled?: boolean;
	sent?: boolean;
	className?: string;
	label?: string;
	hint?: string;
}) {
	if (sent) return null;

	return (
		<>
			<label className={className}>
				<input name="push_enabled" type="checkbox" defaultChecked={enabled} />
				<span>{label}</span>
			</label>

			{hint && <small>{hint}</small>}
		</>
	);
}
