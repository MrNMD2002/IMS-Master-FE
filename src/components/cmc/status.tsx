import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { Device, DeviceStatus, IncidentStatus } from "#/cmc";
import type { VehicleSignal } from "@/hooks/use-vehicle-signal";
import { Badge } from "@/ui/badge";
import { fmtSecondsAgo } from "@/utils/format";

type Variant = "success" | "warning" | "error" | "info" | "default" | "secondary";

const INCIDENT_STATUS_VARIANT: Record<IncidentStatus, Variant> = {
	PROCESSING: "warning",
	PENDING_APPROVAL: "info",
	COMPLETED: "success",
};

export const INCIDENT_STATUS_COLOR: Record<IncidentStatus, string> = {
	PROCESSING: "#FFAB00",
	PENDING_APPROVAL: "#00B8D9",
	COMPLETED: "#22C55E",
};

const DEVICE_STATUS_VARIANT: Record<DeviceStatus, Variant> = {
	ACTIVE: "success",
	INACTIVE: "secondary",
	LOST: "error",
	MAINTENANCE: "warning",
};

function Dot() {
	return <span className="h-1.5 w-1.5 rounded-full bg-current" />;
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
	const { t } = useTranslation();
	return (
		<Badge variant={INCIDENT_STATUS_VARIANT[status] ?? "default"}>
			<Dot />
			{t(`incident.status.${status}`, { defaultValue: status })}
		</Badge>
	);
}

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
	const { t } = useTranslation();
	return (
		<Badge variant={DEVICE_STATUS_VARIANT[status] ?? "default"}>
			<Dot />
			{t(`device.status.${status}`, { defaultValue: status })}
		</Badge>
	);
}

/** Xe đang điều động / sẵn sàng. */
export function MobilizedBadge({ mobilized }: { mobilized?: boolean | null }) {
	const { t } = useTranslation();
	return mobilized ? (
		<Badge variant="warning">
			<Dot />
			{t("device.mobilized")}
		</Badge>
	) : (
		<Badge variant="success">
			<Dot />
			{t("device.ready")}
		</Badge>
	);
}

/**
 * Trạng thái xe như trên bản đồ giám sát: đang làm nhiệm vụ → không khả dụng (ngừng hoạt động /
 * loại bị khoá) → mất tín hiệu (không có vị trí trong 60 giây) → sẵn sàng.
 * `signal` = null khi không xem được GPS: bỏ qua bước mất tín hiệu.
 */
export function VehicleStateBadge({ device, signal }: { device: Device; signal: VehicleSignal | null }) {
	const { t } = useTranslation();
	if (device.is_mobilized) return <MobilizedBadge mobilized />;
	if (device.available === false || device.status !== "ACTIVE") {
		return (
			<Tooltip title={device.unavailable_reason}>
				<span>
					<Badge variant="error">
						<Dot />
						{t("monitor.state.unavailable")}
					</Badge>
				</span>
			</Tooltip>
		);
	}
	if (signal && !signal.online) {
		const hint =
			signal.secondsAgo == null
				? t("device.neverReported")
				: t("device.lastReported", { time: fmtSecondsAgo(signal.secondsAgo) });
		return (
			<Tooltip title={hint}>
				<span>
					<Badge variant="secondary">
						<Dot />
						{t("monitor.state.offline")}
					</Badge>
				</span>
			</Tooltip>
		);
	}
	return <MobilizedBadge mobilized={false} />;
}

export function ActiveBadge({ active }: { active: boolean }) {
	const { t } = useTranslation();
	return active ? (
		<Badge variant="success">
			<Dot />
			{t("common.activeText")}
		</Badge>
	) : (
		<Badge variant="error">
			<Dot />
			{t("common.lockedText")}
		</Badge>
	);
}
