import { Input, Tag, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { AiStationDetail } from "#/vigil";
import EmptyState from "@/components/cmc/empty-state";
import { Icon } from "@/components/icon";
import { cn } from "@/utils";
import { pluginLabel } from "../../ai-event/components/event-meta";
import { CameraControls } from "./station-commands";
import { type CameraFilter, cameraBucket } from "./station-overview";
import { CameraStateBadge } from "./station-status";

/**
 * Tab Camera: lọc theo nhóm trạng thái + tìm theo
 * tên, mỗi camera một dòng thẻ với điều khiển ở cuối dòng.
 */
export default function StationCameras({
	station: st,
	filter,
	onFilterChange,
	search,
	onSearchChange,
	canManage,
}: {
	station: AiStationDetail;
	filter: CameraFilter;
	onFilterChange: (f: CameraFilter) => void;
	search: string;
	onSearchChange: (s: string) => void;
	canManage: boolean;
}) {
	const { t } = useTranslation();
	const counts: Record<CameraFilter, number> = { all: st.cameras.length, live: 0, off: 0, error: 0 };
	for (const c of st.cameras) counts[cameraBucket(c.state)]++;
	const kw = search.trim().toLowerCase();
	const list = st.cameras.filter(
		(c) =>
			(filter === "all" || cameraBucket(c.state) === filter) &&
			(!kw || c.name.toLowerCase().includes(kw) || String(c.id) === kw),
	);
	const pluginName = (n: string) => st.plugins.find((p) => p.name === n)?.display_name ?? pluginLabel(t, n);

	if (!st.cameras.length) return <EmptyState text={t("aiStation.noCameras")} />;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<div className="flex flex-wrap gap-1.5">
					{(["all", "live", "off", "error"] as const).map((f) => (
						<button
							type="button"
							key={f}
							onClick={() => onFilterChange(f)}
							className={cn(
								"inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
								filter === f
									? "border-primary/50 bg-primary/10 font-medium text-primary"
									: "border-border text-text-secondary hover:bg-muted",
							)}
						>
							{t(`aiStation.camFilter.${f}`)}
							<span className="font-mono text-xs tabular-nums opacity-70">{counts[f]}</span>
						</button>
					))}
				</div>
				<Input
					allowClear
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
					placeholder={t("aiStation.camFilter.search")}
					prefix={<Icon icon="solar:magnifer-linear" size={16} className="text-text-secondary" />}
					className="ml-auto w-full sm:w-64"
				/>
			</div>

			{list.length ? (
				<ul className="m-0 flex list-none flex-col gap-2 p-0">
					{list.map((c) => (
						<li
							key={c.id}
							className="flex flex-col gap-3 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center"
						>
							<div className="flex min-w-0 flex-1 items-center gap-3">
								<span
									className={cn(
										"flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
										c.state === "live" ? "bg-success/10 text-success" : "bg-muted text-text-secondary",
									)}
								>
									<Icon icon="solar:videocamera-record-bold-duotone" size={22} />
								</span>
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<span className="font-medium">{c.name}</span>
										<span className="font-mono text-xs text-text-secondary">#{c.id}</span>
										<CameraStateBadge state={c.state} />
									</div>
									<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
										<span className="font-mono tabular-nums">
											{c.state === "live" ? `${c.fps.toFixed(1)} fps · ${c.resolution.replace("x", " × ")}` : "—"}
										</span>
										{c.plugins.length ? (
											<span className="flex flex-wrap gap-1">
												{c.plugins.map((p) => {
													const off = st.plugins.find((x) => x.name === p)?.enabled === false;
													return (
														<Tooltip key={p} title={off ? t("aiStation.plugin.offOnStation") : p}>
															<Tag className="m-0" color={off ? undefined : "processing"} bordered={!off}>
																<span className={off ? "line-through opacity-60" : undefined}>{pluginName(p)}</span>
															</Tag>
														</Tooltip>
													);
												})}
											</span>
										) : (
											<span className="text-text-disabled">{t("aiStation.cam.noPlugin")}</span>
										)}
									</div>
								</div>
							</div>
							<div className="shrink-0 border-t border-border/60 pt-2 sm:border-0 sm:pt-0">
								<CameraControls station={st} camera={c} online={st.online} canManage={canManage} />
							</div>
						</li>
					))}
				</ul>
			) : (
				<EmptyState text={t("aiStation.camFilter.none")} />
			)}
		</div>
	);
}
