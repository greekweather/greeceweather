"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { DownloadPng } from "@/components/outlook/DownloadPng";

const ZOOM_STEPS = [100, 150, 200, 300];

type Focus = { fx: number; fy: number };

/**
 * Wraps the server-rendered graphic. It always starts as the whole map fitted to the screen
 * (small on a phone). Tap the map, or use + / -, to zoom in and scroll around; the save
 * button downloads the full-size picture.
 */
export function OutlookViewer({
	children,
	fileName,
}: {
	children: React.ReactNode;
	fileName: string;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const wrapRef = useRef<HTMLDivElement>(null);
	const focusRef = useRef<Focus | null>(null);
	const [zoom, setZoom] = useState(100);

	// After the width changes, scroll so the point that was tapped (or the centre) stays put.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs once per zoom change
	useLayoutEffect(() => {
		const scroller = scrollRef.current;
		const focus = focusRef.current;
		focusRef.current = null;

		if (!scroller || !focus) return;

		scroller.scrollLeft = focus.fx * scroller.scrollWidth - scroller.clientWidth / 2;
		scroller.scrollTop = focus.fy * scroller.scrollHeight - scroller.clientHeight / 2;
	}, [zoom]);

	function currentCentre(): Focus {
		const scroller = scrollRef.current;

		if (!scroller) return { fx: 0.5, fy: 0.5 };

		return {
			fx: (scroller.scrollLeft + scroller.clientWidth / 2) / scroller.scrollWidth,
			fy: (scroller.scrollTop + scroller.clientHeight / 2) / scroller.scrollHeight,
		};
	}

	function step(direction: 1 | -1, focus?: Focus) {
		const index = ZOOM_STEPS.indexOf(zoom);
		const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, index + direction))];

		if (next === zoom) return;

		focusRef.current = focus ?? currentCentre();
		setZoom(next);
	}

	function onTap(event: React.MouseEvent<HTMLDivElement>) {
		const wrap = wrapRef.current;

		if (!wrap) return;

		if (zoom > 100) {
			focusRef.current = currentCentre();
			setZoom(100);
			return;
		}

		const rect = wrap.getBoundingClientRect();

		step(1, {
			fx: (event.clientX - rect.left) / rect.width,
			fy: (event.clientY - rect.top) / rect.height,
		});
	}

	return (
		<div className="outlook-viewer">
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: the +/- buttons below do the same */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: tap-to-zoom is a shortcut; the +/- buttons are the accessible control */}
			<div
				className={`outlook-scroll ${zoom > 100 ? "zoomed" : ""}`}
				data-outlook-graphic
				ref={scrollRef}
				onClick={onTap}
			>
				<div className="outlook-graphic-wrap" ref={wrapRef} style={{ width: `${zoom}%` }}>
					{children}
				</div>
			</div>

			<div className="outlook-viewer-bar">
				<div className="outlook-zoom-controls" role="toolbar" aria-label="Μεγέθυνση χάρτη">
					<button
						type="button"
						className="button secondary"
						onClick={() => step(-1)}
						disabled={zoom === ZOOM_STEPS[0]}
						aria-label="Σμίκρυνση"
					>
						−
					</button>
					<span className="outlook-zoom-value">{zoom}%</span>
					<button
						type="button"
						className="button secondary"
						onClick={() => step(1)}
						disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]}
						aria-label="Μεγέθυνση"
					>
						+
					</button>
				</div>

				<DownloadPng fileName={fileName} containerRef={scrollRef} />
			</div>
		</div>
	);
}
