import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils";

/** Trạm coi là mất kết nối khi im lâu hơn mức này (khớp `ONLINE_TIMEOUT` của API). */
const TIMEOUT_MS = 90_000;
/** Bề rộng thời gian của dải — đủ để thấy ngưỡng mất kết nối. */
const WINDOW_MS = 120_000;

/**
 * Dải nhịp tim (theo trang AI agent của hệ tham khảo): mỗi lần trạm báo `status` (~30 s) là một
 * vạch. API chỉ trả mốc `last_seen` gần nhất nên vạch nào cũng là dữ liệu thật quan sát được
 * trong phiên xem — không vẽ lịch sử giả. Im quá 90 s thì dải phẳng xám.
 */
export default function PulseStrip({ lastSeen, online }: { lastSeen: string | null; online: boolean }) {
	const { t } = useTranslation();
	const lastMs = lastSeen ? new Date(lastSeen).getTime() : null;
	const [beats, setBeats] = useState<number[]>(() => (lastMs ? [lastMs] : []));
	const newest = useRef(lastMs);

	useEffect(() => {
		if (lastMs == null || lastMs === newest.current) return;
		newest.current = lastMs;
		setBeats((prev) => [...prev, lastMs].slice(-30));
	}, [lastMs]);

	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = window.setInterval(() => !document.hidden && setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, []);

	const age = lastMs == null ? null : Math.max(now - lastMs, 0);
	const flat = !online || age == null || age > TIMEOUT_MS;
	const fading = !flat && age != null && age > TIMEOUT_MS / 2;
	const visible = flat ? [] : beats.filter((b) => now - b <= WINDOW_MS);

	return (
		<div className="flex items-center gap-4 border-t border-border/60 px-4 py-2 sm:px-5">
			<div className="relative h-6 min-w-0 flex-1" aria-hidden>
				<div
					className={cn(
						"absolute inset-x-0 top-1/2 h-px -translate-y-1/2 transition-colors",
						flat ? "bg-text-disabled/40" : fading ? "bg-warning/40" : "bg-success/40",
					)}
				/>
				{/* Vạch ngưỡng mất kết nối */}
				<span
					className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-text-disabled/50"
					style={{ left: `${(1 - TIMEOUT_MS / WINDOW_MS) * 100}%` }}
				/>
				{visible.map((b) => {
					const left = (1 - (now - b) / WINDOW_MS) * 100;
					const isNewest = b === beats[beats.length - 1];
					return (
						<span
							key={b}
							className={cn(
								"absolute top-1/2 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left] duration-1000 ease-linear",
								isNewest ? "h-4" : "h-2.5",
								fading && isNewest ? "bg-warning" : "bg-success",
							)}
							style={{ left: `${left}%`, opacity: Math.max(0.25, 1 - (now - b) / WINDOW_MS) }}
						/>
					);
				})}
			</div>
			<div className="flex shrink-0 items-baseline gap-2">
				<span className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
					{t("aiStation.pulse.label")}
				</span>
				<span
					className={cn(
						"font-mono text-[13px] tabular-nums",
						flat ? "text-text-secondary" : fading ? "text-warning" : "text-text-primary",
					)}
				>
					{age == null
						? t("aiStation.pulse.never")
						: flat
							? t("aiStation.pulse.silent", { since: formatAge(age, t) })
							: t("aiStation.pulse.since", { since: formatAge(age, t) })}
				</span>
			</div>
		</div>
	);
}

function formatAge(ms: number, t: (k: string, v?: Record<string, unknown>) => string): string {
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return t("aiStation.pulse.sec", { n: sec });
	const min = Math.floor(sec / 60);
	if (min < 60) return t("aiStation.pulse.min", { n: min });
	const hour = Math.floor(min / 60);
	if (hour < 24) return t("aiStation.pulse.hour", { n: hour });
	return t("aiStation.pulse.day", { n: Math.floor(hour / 24) });
}
