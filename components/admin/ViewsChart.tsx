import { niceMax } from "@/lib/stats";

type Point = { day: string; views: number };

const W = 720;
const H = 260;
const PAD = { top: 16, right: 12, bottom: 34, left: 42 };

function shortDay(day: string) {
	const [, m, d] = day.split("-");

	return `${Number(d)}/${Number(m)}`;
}

// Bar chart of views per day, drawn as plain SVG so it needs no script. Each bar has a
// tooltip with the exact day and number.
export function ViewsChart({ points, label }: { points: Point[]; label: string }) {
	const max = niceMax(Math.max(0, ...points.map((point) => point.views)));
	const plotW = W - PAD.left - PAD.right;
	const plotH = H - PAD.top - PAD.bottom;
	const slot = plotW / Math.max(points.length, 1);
	const barW = Math.max(2, Math.min(28, slot * 0.7));
	const every = Math.ceil(points.length / 8);
	const ticks = [0, 0.25, 0.5, 0.75, 1];

	return (
		<svg
			className="views-chart"
			viewBox={`0 0 ${W} ${H}`}
			role="img"
			aria-label={`${label}: προβολές ανά ημέρα`}
		>
			{ticks.map((tick) => {
				const y = PAD.top + plotH - tick * plotH;

				return (
					<g key={tick}>
						<line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className="views-chart-grid" />
						<text x={PAD.left - 8} y={y + 4} textAnchor="end" className="views-chart-label">
							{Math.round(tick * max)}
						</text>
					</g>
				);
			})}

			{points.map((point, index) => {
				const h = (point.views / max) * plotH;
				const x = PAD.left + index * slot + (slot - barW) / 2;

				return (
					<g key={point.day}>
						<rect
							x={x}
							y={PAD.top + plotH - h}
							width={barW}
							height={Math.max(h, point.views > 0 ? 1 : 0)}
							rx={2}
							className="views-chart-bar"
						>
							<title>{`${shortDay(point.day)}: ${point.views}`}</title>
						</rect>

						{(points.length - 1 - index) % every === 0 && (
							<text x={x + barW / 2} y={H - 12} textAnchor="middle" className="views-chart-label">
								{shortDay(point.day)}
							</text>
						)}
					</g>
				);
			})}
		</svg>
	);
}
