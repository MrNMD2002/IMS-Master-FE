import { useQuery } from "@tanstack/react-query";
import { Checkbox, InputNumber, Segmented } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import gpsService from "@/api/services/gpsService";
import { Icon } from "@/components/icon";
import EmptyState from "@/components/ims/empty-state";
import { MobilizedBadge } from "@/components/ims/status";
import { cn } from "@/utils";

interface Props {
	lat?: number | null;
	lng?: number | null;
	value: number[];
	onChange: (ids: number[]) => void;
	/** Xe đã có trong sự vụ — hiện nhưng không chọn lại được. */
	excludeIds?: number[];
	/** Đơn vị phụ trách sự vụ — chỉ điều được xe của đơn vị này và cấp dưới. */
	tenantId?: number | null;
	maxHeight?: number;
}

/** Danh sách xe quanh một điểm (gần nhất trước) để chọn điều động. */
export default function NearbyVehicles({
	lat,
	lng,
	value,
	onChange,
	excludeIds = [],
	tenantId,
	maxHeight = 320,
}: Props) {
	const { t } = useTranslation();
	const [radius, setRadius] = useState(10);
	const [filter, setFilter] = useState<"ready" | "all">("ready");
	const enabled = lat !== null && lat !== undefined && lng !== null && lng !== undefined;

	const { data, isFetching } = useQuery({
		queryKey: ["gps-nearby", lat, lng, radius, tenantId],
		queryFn: () =>
			gpsService.nearby({
				latitude: lat as number,
				longitude: lng as number,
				radius_km: radius,
				tenant_id: tenantId ?? undefined,
				page_size: 100,
			}),
		enabled,
	});

	const rows = useMemo(() => {
		const all = data?.data ?? [];
		// "Sẵn sàng": chưa làm nhiệm vụ VÀ khả dụng (không bảo trì / mất / loại bị khoá).
		return filter === "ready" ? all.filter((r) => !r.device?.is_mobilized && r.device?.available !== false) : all;
	}, [data, filter]);

	if (!enabled) {
		return <EmptyState text={t("dispatch.pickLocationFirst")} icon="solar:map-point-search-bold-duotone" />;
	}

	const toggle = (id: number, checked: boolean) => onChange(checked ? [...value, id] : value.filter((v) => v !== id));

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Segmented
					size="small"
					value={filter}
					onChange={(v) => setFilter(v as "ready" | "all")}
					options={[
						{ label: t("dispatch.readyOnly"), value: "ready" },
						{ label: t("common.all"), value: "all" },
					]}
				/>
				<div className="flex items-center gap-1 text-xs text-text-secondary">
					{t("dispatch.radius")}
					<InputNumber
						size="small"
						min={1}
						max={500}
						value={radius}
						onChange={(v) => setRadius(v || 10)}
						style={{ width: 70 }}
					/>
					km
				</div>
			</div>
			<div className="flex flex-col gap-1 overflow-y-auto pr-1" style={{ maxHeight }}>
				{isFetching && !rows.length && (
					<p className="py-6 text-center text-sm text-text-secondary">{t("common.loadingText")}</p>
				)}
				{!isFetching && rows.length === 0 && (
					<EmptyState text={t("dispatch.noVehicle")} icon="solar:bus-bold-duotone" />
				)}
				{rows.map((r) => {
					const already = excludeIds.includes(r.id);
					const busy = !!r.device?.is_mobilized;
					const blocked = r.device?.available === false;
					const checked = value.includes(r.id);
					return (
						<label
							key={r.id}
							className={cn(
								"flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
								checked ? "border-primary bg-primary/5" : "hover:bg-action-hover",
								(already || busy || blocked) && "cursor-not-allowed opacity-60",
							)}
						>
							<Checkbox
								checked={checked}
								disabled={already || busy || blocked}
								onChange={(e) => toggle(r.id, e.target.checked)}
							/>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium">{r.name || r.imei}</p>
								<p className="truncate text-xs text-text-secondary">
									{r.device?.device_type_name ?? ""}
									{r.tenant_name ? ` · ${r.tenant_name}` : ""}
								</p>
							</div>
							<div className="flex flex-col items-end gap-1">
								<span className="flex items-center gap-1 text-xs font-semibold text-primary">
									<Icon icon="solar:routing-2-linear" size={14} />
									{r.distance_km !== null && r.distance_km !== undefined ? `${r.distance_km.toFixed(1)} km` : "—"}
								</span>
								{already ? (
									<span className="text-[11px] text-text-secondary">{t("dispatch.alreadyIn")}</span>
								) : blocked && !busy ? (
									<span
										className="max-w-[160px] truncate text-[11px] text-error"
										title={r.device?.unavailable_reason ?? ""}
									>
										{r.device?.unavailable_reason ?? t("monitor.state.unavailable")}
									</span>
								) : (
									<MobilizedBadge mobilized={busy} />
								)}
							</div>
						</label>
					);
				})}
			</div>
			{value.length > 0 && (
				<p className="text-xs text-text-secondary">{t("dispatch.selected", { count: value.length })}</p>
			)}
		</div>
	);
}
