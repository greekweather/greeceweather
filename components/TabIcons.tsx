// Small outline icons for the phone tab bars. Decorative: the text label carries the meaning.
function Icon({ children }: { children: React.ReactNode }) {
	return (
		<svg
			width={24}
			height={24}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.8}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			{children}
		</svg>
	);
}

export const icons = {
	home: (
		<Icon>
			<path d="M3 11l9-7 9 7" />
			<path d="M5 10v10h5v-6h4v6h5V10" />
		</Icon>
	),
	articles: (
		<Icon>
			<path d="M6 3h9l4 4v14H6z" />
			<path d="M9 12h7M9 16h7M9 8h3" />
		</Icon>
	),
	maps: (
		<Icon>
			<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" />
			<path d="M9 4v14M15 6v14" />
		</Icon>
	),
	admin: (
		<Icon>
			<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" />
			<path d="M9 12l2 2 4-4" />
		</Icon>
	),
	dashboard: (
		<Icon>
			<rect x="3" y="3" width="7" height="9" rx="1.5" />
			<rect x="14" y="3" width="7" height="5" rx="1.5" />
			<rect x="14" y="12" width="7" height="9" rx="1.5" />
			<rect x="3" y="16" width="7" height="5" rx="1.5" />
		</Icon>
	),
	banner: (
		<Icon>
			<rect x="3" y="6" width="18" height="12" rx="2" />
			<path d="M7 10h10M7 14h6" />
		</Icon>
	),
	more: (
		<Icon>
			<circle cx="5" cy="12" r="1.2" />
			<circle cx="12" cy="12" r="1.2" />
			<circle cx="19" cy="12" r="1.2" />
		</Icon>
	),
} as const;
