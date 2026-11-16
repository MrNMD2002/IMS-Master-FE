import { Alert, Progress, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { AccelKind, AiStation, CameraState } from "#/vigil";
import { isVigilMock } from "@/api/services/aiStationService";
import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { cn } from "@/utils";
import { fmtDateTime, fmtFromNow } from "@/utils/format";

type StationState = "online" | "offline" | "unpaired";

export const stationState = (s: Pick<AiStation, "online" | "paired" | "last_seen">): StationState =>
	s.online ? "online" : !s.paired && !s.last_seen ? "unpaired" : "offline";

const DOT: Record<StationState, string> = {
	online: "bg-success",
	offline: "bg-error",
	unpaired: "bg-text-disabled",
};

/** Chấm trạng thái (nháy nhẹ khi trực tuyến). */
export function StatusDot({ state, className }: { state: StationState; className?: string }) {
	return (
		<span className={cn("relative inline-flex h-2.5 w-2.5 shrink-0", className)}>
			{state === "online" && (
				<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
			)}
			<span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", DOT[state])} />
		</span>
	);
}

/** "● Trực tuyến · lần cuối 12 giây trước". */
export function StationOnline({ station, compact }: { station: AiStation; compact?: boolean }) {
	const { t } = useTranslation();
	const state = stationState(station);
	const label = t(`aiStation.state.${state}`);
	const seen = station.last_seen
		? t("aiStation.lastSeen", { time: fmtFromNow(station.last_seen) })
		: t("aiStation.neverSeen");
	return (
		<Tooltip title={station.last_seen ? fmtDateTime(station.last_seen, "DD/MM/YYYY HH:mm:ss") : undefined}>
			<span className="inline-flex min-w-0 items-center gap-2">
				<StatusDot state={state} />
				<span className="min-w-0">
					<span
						className={cn(
							"block text-sm font-medium",
							state === "online" && "text-success",
							state === "offline" && "text-error",
						)}
					>
						{label}
					</span>
					{!compact && <span className="block truncate text-xs text-text-secondary">{seen}</span>}
				</span>
			</span>
		</Tooltip>
	);
}

export function AccelLabel({ accel, gpu }: { accel?: AccelKind | null; gpu?: string | null }) {
	const { t } = useTranslation();
	if (!accel) return <span className="text-text-disabled">—</span>;
	return (
		<span className="inline-flex min-w-0 items-center gap-1.5">
			<Icon
				icon={accel === "cpu" ? "solar:cpu-bold-duotone" : "solar:cpu-bolt-bold-duotone"}
				size={18}
				className={accel === "cpu" ? "text-text-secondary" : "text-primary"}
			/>
			<span className="min-w-0">
				<span className="block truncate text-sm">{gpu || "CPU"}</span>
				<span className="block text-xs text-text-secondary">{t(`aiStation.accel.${accel}`)}</span>
			</span>
		</span>
	);
}

const CAMERA_VARIANT: Record<CameraState, "success" | "info" | "error" | "secondary"> = {
	live: "success",
	connecting: "info",
	error: "error",
	off: "secondary",
};

export function CameraStateBadge({ state }: { state: CameraState }) {
	const { t } = useTranslation();
	return (
		<Badge variant={CAMERA_VARIANT[state] ?? "secondary"}>
			<span className="h-1.5 w-1.5 rounded-full bg-current" />
			{t(`aiStation.camState.${state}`)}
		</Badge>
	);
}

/** Camera đang chạy / tổng, kèm thanh nhỏ. */
export function CameraCount({ live, total }: { live: number; total: number }) {
	const { t } = useTranslation();
	return (
		<span className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
			<Icon icon="solar:videocamera-record-bold-duotone" size={18} className="text-text-secondary" />
			<span>
				<b>{live}</b>
				<span className="text-text-secondary">/{total}</span>
			</span>
			<span className="sr-only">{t("aiStation.camerasLive", { live, total })}</span>
		</span>
	);
}

export function AlarmCell({ alarms }: { alarms: string[] }) {
	const { t } = useTranslation();
	if (!alarms.length) return <span className="text-text-disabled text-sm">{t("aiStation.noAlarm")}</span>;
	return (
		<Tooltip
			title={
				<ul className="m-0 list-disc pl-4">
					{alarms.map((a) => (
						<li key={a}>{a}</li>
					))}
				</ul>
			}
		>
			<span className="inline-flex max-w-[220px] items-center gap-1 text-sm text-warning-dark dark:text-warning">
				<Icon icon="solar:danger-triangle-bold" size={16} className="shrink-0" />
				<span className="truncate">
					{alarms.length > 1 ? t("aiStation.alarmCount", { n: alarms.length }) : alarms[0]}
				</span>
			</span>
		</Tooltip>
	);
}

export function UsageBar({ label, value }: { label: string; value?: number | null }) {
	const v = value ?? null;
	const color =
		v == null ? undefined : v >= 85 ? "var(--colors-palette-error-default, #FF5630)" : v >= 65 ? "#FFAB00" : undefined;
	return (
		<div>
			<div className="mb-1 flex items-center justify-between text-xs">
				<span className="text-text-secondary">{label}</span>
				<span className="font-medium tabular-nums">{v == null ? "—" : `${v.toFixed(0)}%`}</span>
			</div>
			<Progress percent={v ?? 0} showInfo={false} size="small" strokeColor={color} />
		</div>
	);
}

/** Nhắc rằng trang đang chạy bằng dữ liệu giả. */
export function MockNotice() {
	const { t } = useTranslation();
	if (!isVigilMock) return null;
	return <Alert type="info" showIcon className="mb-3" message={t("aiStation.mockBanner")} />;
}
