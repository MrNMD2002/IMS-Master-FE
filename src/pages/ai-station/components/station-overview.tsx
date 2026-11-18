import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { AiStationDetail, CameraState } from "#/vigil";
import { Icon } from "@/components/icon";
import { isStationPluginShown } from "@/constants/ai-plugins";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { cn } from "@/utils";
import { fmtDateTime } from "@/utils/format";
import { AccelLabel, UsageBar } from "./station-status";

export type CameraFilter = "all" | "live" | "off" | "error";

/** Trạng thái camera → nhóm lọc ở tab Camera. */
export const cameraBucket = (s: CameraState): Exclude<CameraFilter, "all"> =>
	s === "live" ? "live" : s === "off" ? "off" : "error";

const TILE: Record<Exclude<CameraFilter, "all">, string> = {
	live: "border-success/40 bg-success/5",
	off: "border-border bg-muted/40",
	error: "border-error/40 bg-error/5",
};
const DOT: Record<Exclude<CameraFilter, "all">, string> = {
	live: "bg-success",
	off: "bg-text-disabled",
	error: "bg-error",
};

/** Ô sức khoẻ: tiêu đề nhỏ, giá trị lớn, dòng phụ, nút "Xem" sang tab chi tiết. */
function HealthCard({
	icon,
	title,
	tone,
	value,
	sub,
	onView,
	children,
}: {
	icon: string;
	title: string;
	tone: "ok" | "warn" | "error" | "muted";
	value: ReactNode;
	sub?: ReactNode;
	onView?: () => void;
	children?: ReactNode;
}) {
	const { t } = useTranslation();
	const color = { ok: "text-success", warn: "text-warning", error: "text-error", muted: "text-text-secondary" }[tone];
	return (
		<Card className="gap-3 py-4">
			<CardContent className="flex flex-col gap-2 px-4">
				<div className="flex items-center justify-between gap-2">
					<span className="inline-flex items-center gap-2 text-sm text-text-secondary">
						<Icon icon={icon} size={18} className={color} />
						{title}
					</span>
					{onView && (
						<button type="button" onClick={onView} className="text-xs text-primary hover:underline">
							{t("aiStation.overview.view")}
						</button>
					)}
				</div>
				<div className="text-2xl font-bold leading-tight">{value}</div>
				{sub && <div className="text-xs text-text-secondary">{sub}</div>}
				{children}
			</CardContent>
		</Card>
	);
}

/** Tab Tổng quan: 4 ô sức khoẻ + "giá camera" + cảnh báo. */
export default function StationOverview({
	station: st,
	onInspectCameras,
	onInspectPlugins,
}: {
	station: AiStationDetail;
	onInspectCameras: (f: CameraFilter) => void;
	onInspectPlugins: () => void;
}) {
	const { t } = useTranslation();
	const s = st.status;
	const counts = { live: 0, off: 0, error: 0 };
	for (const c of st.cameras) counts[cameraBucket(c.state)]++;
	const shownPlugins = st.plugins.filter(isStationPluginShown);
	const pluginsOn = shownPlugins.filter((p) => p.enabled && !p.missing_models?.length).length;
	const usage = Math.max(s?.cpu_pct ?? 0, s?.ram_pct ?? 0, s?.gpu_pct ?? 0);

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<HealthCard
					icon="solar:wi-fi-router-bold-duotone"
					title={t("aiStation.overview.connection")}
					tone={st.online ? "ok" : st.paired ? "error" : "muted"}
					value={
						st.online
							? t("aiStation.state.online")
							: st.paired
								? t("aiStation.state.offline")
								: t("aiStation.state.unpaired")
					}
					sub={
						st.last_seen
							? t("aiStation.overview.lastSeen", { time: fmtDateTime(st.last_seen) })
							: t("aiStation.notPaired")
					}
				/>
				<HealthCard
					icon="solar:cpu-bolt-bold-duotone"
					title={t("aiStation.resources")}
					tone={!s ? "muted" : usage >= 90 ? "error" : usage >= 75 ? "warn" : "ok"}
					value={<AccelLabel accel={s?.accel} gpu={s?.gpu} />}
				>
					<div className="flex flex-col gap-1.5 pt-1">
						<UsageBar label="CPU" value={s?.cpu_pct} />
						<UsageBar label="RAM" value={s?.ram_pct} />
						<UsageBar label="GPU" value={s?.gpu_pct} />
					</div>
				</HealthCard>
				<HealthCard
					icon="solar:videocamera-record-bold-duotone"
					title={t("aiStation.field.cameras")}
					tone={counts.error ? "warn" : st.cameras.length ? "ok" : "muted"}
					value={
						<span>
							{counts.live}
							<span className="text-base font-normal text-text-secondary">/{st.cameras.length}</span>
						</span>
					}
					sub={t("aiStation.overview.cameraSub", counts)}
					onView={() => onInspectCameras("all")}
				/>
				<HealthCard
					icon="solar:widget-add-bold-duotone"
					title={t("aiStation.overview.plugins")}
					tone={pluginsOn ? "ok" : "muted"}
					value={
						<span>
							{pluginsOn}
							<span className="text-base font-normal text-text-secondary">/{shownPlugins.length}</span>
						</span>
					}
					sub={t("aiStation.overview.pluginSub", { n: st.events_today })}
					onView={onInspectPlugins}
				/>
			</div>

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
				<Card className="xl:col-span-2">
					<CardHeader className="flex flex-row items-center justify-between">
						<CardTitle>{t("aiStation.overview.bay")}</CardTitle>
						<span className="text-xs text-text-secondary">{t("aiStation.overview.bayHint")}</span>
					</CardHeader>
					<CardContent>
						{st.cameras.length ? (
							<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
								{st.cameras.map((c) => {
									const b = cameraBucket(c.state);
									return (
										<button
											type="button"
											key={c.id}
											onClick={() => onInspectCameras(b)}
											className={cn(
												"flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:border-primary/60",
												TILE[b],
											)}
										>
											<span className="flex items-center gap-1.5 text-xs text-text-secondary">
												<span className={cn("h-2 w-2 rounded-full", DOT[b])} />
												{t(`aiStation.camState.${c.state}`)}
												<span className="ml-auto font-mono">#{c.id}</span>
											</span>
											<span className="line-clamp-2 text-sm font-medium">{c.name}</span>
											<span className="font-mono text-xs text-text-secondary">
												{c.state === "live" ? `${c.fps.toFixed(1)} fps · ${c.resolution}` : "—"}
											</span>
										</button>
									);
								})}
							</div>
						) : (
							<p className="text-sm text-text-disabled">{t("aiStation.noCameras")}</p>
						)}
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{t("aiStation.field.alarms")}</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-2">
						{st.alarms.length ? (
							<ul className="m-0 flex list-none flex-col gap-1.5 p-0">
								{st.alarms.map((a) => (
									<li
										key={a}
										className="flex items-start gap-2 rounded-md bg-warning/10 px-2.5 py-1.5 text-sm text-warning-dark dark:text-warning"
									>
										<Icon icon="solar:danger-triangle-bold" size={16} className="mt-0.5 shrink-0" />
										{a}
									</li>
								))}
							</ul>
						) : (
							<p className="flex items-center gap-2 text-sm text-text-secondary">
								<Icon icon="solar:check-circle-bold" size={18} className="text-success" />
								{t("aiStation.noAlarm")}
							</p>
						)}
						{s && (
							<p className="pt-1 text-xs text-text-disabled">
								{t("aiStation.statusAt", { time: fmtDateTime(s.ts / 1000, "DD/MM/YYYY HH:mm:ss") })}
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
