import { useTranslation } from "react-i18next";
import type { DeviceStatus, IncidentStatus } from "#/cmc";
import { Badge } from "@/ui/badge";

type Variant = "success" | "warning" | "error" | "info" | "default" | "secondary";

export const INCIDENT_STATUS_VARIANT: Record<IncidentStatus, Variant> = {
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

export function OnlineBadge({ online }: { online: boolean }) {
	const { t } = useTranslation();
	return online ? (
		<Badge variant="success">
			<Dot />
			{t("monitor.online")}
		</Badge>
	) : (
		<Badge variant="secondary">
			<Dot />
			{t("monitor.offline")}
		</Badge>
	);
}
