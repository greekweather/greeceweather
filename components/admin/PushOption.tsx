// The "send a notification" tick shown in the article, map and banner forms. It is ticked by
// default. Once the announcement has gone out there is nothing left to choose, so a note is shown
// instead, and "push_sent" tells the save to leave the setting alone.
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
	if (sent) {
		return (
			<>
				<input type="hidden" name="push_sent" value="1" />
				<small className="push-sent-note">
					🔔 Έχει ήδη ανακοινωθεί με ειδοποίηση, δεν θα σταλεί ξανά.
				</small>
			</>
		);
	}

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
