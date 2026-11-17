import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Marker, Popup } from "react-leaflet";
import { useNavigate } from "react-router";
import type { Camera, CameraStationLink } from "#/camera";
import { INCIDENT_STATUSES, type Incident } from "#/cmc";
import cameraService from "@/api/services/cameraService";
import incidentService from "@/api/services/incidentService";
import systemService from "@/api/services/systemService";
import { Chart, useChart } from "@/components/chart";
import EmptyState from "@/components/cmc/empty-state";
import BaseMap from "@/components/cmc/map/base-map";
import FitBounds from "@/components/cmc/map/fit-bounds";
import { type CameraMapState, cameraIcon, vehicleIcon } from "@/components/cmc/map/markers";
import OrgUnitFilter from "@/components/cmc/org-unit-filter";
import { STICKY_PAGE_BAR } from "@/components/cmc/page-header";
import StatCard from "@/components/cmc/stat-card";
import { INCIDENT_STATUS_COLOR, IncidentStatusBadge } from "@/components/cmc/status";
import { LiveClock, WorkQuote } from "@/components/cmc/work-hero";
import { Icon } from "@/components/icon";
import { AI_STATION_READ_GATE, INCIDENT_READ_GATE, P } from "@/constants/permission";
import { useLiveVehicles } from "@/hooks/use-live-vehicles";
import { useCompactOnScroll } from "@/hooks/use-scrolled";
import { useCan, useUserInfo } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { cn } from "@/utils";
import { fmtFromNow } from "@/utils/format";
import { LiveViewModal } from "../ai-station/components/live-view";

/** Trạng thái tốt nhất của camera trên các trạm đang chạy nó. */
function cameraState(c: Camera): CameraMapState {
	const states = c.stations.map((l) => l.state);
	if (states.includes("live")) return "live";
	if (states.includes("connecting")) return "connecting";
	if (states.includes("error")) return "error";
	return "off";
}

/** Trạm xem trực tiếp được: đang kết nối và đã có mã camera phía trạm. */
const liveLink = (c: Camera): CameraStationLink | undefined =>
	c.stations.find((l) => l.station_online && l.remote_id != null && l.state === "live") ??
	c.stations.find((l) => l.station_online && l.remote_id != null);

export default function DashboardPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const can = useCan();
	const barRef = useRef<HTMLDivElement>(null);
	const compact = useCompactOnScroll(barRef);
	// Lọc theo Tổ chức → Đơn vị (cấp nền tảng thấy nhiều tổ chức).
	const [tenantId, setTenantId] = useState<number | undefined>();
	const { full_name, username, tenant_name } = useUserInfo();
	const canIncident = can(...INCIDENT_READ_GATE);
	const canGps = can(P.GPS_READ);
	const canCamera = can(...AI_STATION_READ_GATE);
	const [live, setLive] = useState<{ camera: Camera; link: CameraStationLink | null } | null>(null);

	const stats = useQuery({
		queryKey: ["dashboard-stats", tenantId],
		queryFn: () => systemService.dashboardStats(tenantId),
		refetchInterval: 30_000,
	});

	const statusCounts = useQueries({
		queries: INCIDENT_STATUSES.map((status) => ({
			queryKey: ["incident-count", status, tenantId],
			queryFn: () => incidentService.list({ status, page_size: 1, tenant_id: tenantId }),
			enabled: canIncident,
			refetchInterval: 30_000,
		})),
	});

	const recent = useQuery({
		queryKey: ["incident-recent", tenantId],
		queryFn: () => incidentService.list({ page_size: 6, sort_by: "created_at", order: "desc", tenant_id: tenantId }),
		enabled: canIncident,
		refetchInterval: 30_000,
	});

	const { vehicles, isLoading: loadingVehicles } = useLiveVehicles({ tenant_id: tenantId }, canGps);
	const online = vehicles.filter((v) => v.is_active).length;
	const mobilized = vehicles.filter((v) => v.state === "mobilized").length;

	const counts = statusCounts.map((q) => q.data?.metadata.total_items ?? 0);
	const totalIncidents = counts.reduce((a, b) => a + b, 0);

	const donut = useChart({
		labels: INCIDENT_STATUSES.map((s) => t(`incident.status.${s}`)),
		colors: INCIDENT_STATUSES.map((s) => INCIDENT_STATUS_COLOR[s]),
		stroke: { show: false },
		legend: { position: "bottom", horizontalAlign: "center" },
		tooltip: { y: { formatter: (v: number) => `${v}` } },
		plotOptions: {
			pie: {
				donut: {
					size: "72%",
					labels: { total: { label: t("dashboard.totalIncidents"), formatter: () => `${totalIncidents}` } },
				},
			},
		},
	});

	// Camera đã đặt vị trí trên bản đồ (theo tổ chức đang lọc).
	const cameraList = useQuery({
		queryKey: ["camera", "dashboard-map", tenantId],
		queryFn: () => cameraService.list({ page: 1, page_size: 200, tenant_id: tenantId }),
		enabled: canCamera,
		refetchInterval: 30_000,
	});
	const cameras = useMemo(
		() => (cameraList.data?.data ?? []).filter((c) => c.latitude != null && c.longitude != null),
		[cameraList.data],
	);
	const points = useMemo(
		() => [
			...vehicles.map((v) => [v.latitude, v.longitude] as [number, number]),
			...cameras.map((c) => [c.latitude, c.longitude] as [number, number]),
		],
		[vehicles, cameras],
	);
	// Khung lại khi danh sách xe đổi, không phải mỗi lần xe nhích vị trí.
	const fitKey = [...vehicles.map((v) => v.id), ...cameras.map((c) => `c${c.id}`)].join(",");
	const showMap = canGps || canCamera;

	return (
		<div className="flex flex-col gap-5">
			{/* Khối ghim: trích dẫn, đồng hồ, bộ lọc, số liệu tổng — thu gọn khi trang đã cuộn. */}
			<div ref={barRef} className={cn(STICKY_PAGE_BAR, "flex flex-col", compact ? "gap-2" : "gap-4")}>
				{/* Câu trích dẫn + đồng hồ */}
				<Card
					className={cn(
						"relative overflow-hidden border-0 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent transition-[padding] duration-200",
						compact ? "gap-2 px-5 py-3" : "gap-5 px-6 py-6",
					)}
				>
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="min-w-0 flex-1 basis-[420px]">
							<WorkQuote compact={compact} />
						</div>
						<LiveClock compact={compact} />
					</div>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<p className="flex items-center gap-2 text-sm text-text-secondary">
							<Icon icon="solar:user-circle-bold-duotone" size={18} />
							<span className="font-medium text-text-primary">{full_name || username}</span>
							{tenant_name && (
								<>
									<span>·</span>
									<Icon icon="solar:buildings-2-bold-duotone" size={16} />
									{tenant_name}
								</>
							)}
						</p>
						<div className="flex flex-wrap items-center gap-2">
							<OrgUnitFilter value={tenantId} onChange={setTenantId} />
							{can(P.INCIDENT_MANAGE) && (
								<Button onClick={() => navigate("/monitoring?create=1")}>
									<Icon icon="solar:add-circle-bold" size={18} />
									{t("incident.create")}
								</Button>
							)}
							{canGps && (
								<Button variant="outline" onClick={() => navigate("/monitoring")}>
									<Icon icon="solar:map-point-wave-bold-duotone" size={18} />
									{t("sys.nav.monitoring")}
								</Button>
							)}
						</div>
					</div>
				</Card>

				{/* Số liệu */}
				<div className={cn("grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4", compact ? "gap-3" : "gap-4")}>
					<StatCard
						compact={compact}
						title={t("dashboard.totalDevices")}
						value={stats.data?.total_devices}
						loading={stats.isLoading}
						icon="solar:bus-bold-duotone"
						tone="primary"
						onClick={can(P.DEVICE_READ) ? () => navigate("/devices") : undefined}
					/>
					<StatCard
						compact={compact}
						title={t("dashboard.onlineDevices")}
						value={canGps ? `${online}/${vehicles.length}` : "—"}
						loading={canGps && loadingVehicles}
						hint={canGps ? t("dashboard.mobilizedCount", { count: mobilized }) : undefined}
						icon="solar:wi-fi-router-bold-duotone"
						tone="success"
						onClick={canGps ? () => navigate("/monitoring") : undefined}
					/>
					<StatCard
						compact={compact}
						title={t("dashboard.processing")}
						value={stats.data?.processing_incidents}
						loading={stats.isLoading}
						icon="solar:siren-rounded-bold-duotone"
						tone="warning"
						onClick={canIncident ? () => navigate("/incidents?status=PROCESSING") : undefined}
					/>
					<StatCard
						compact={compact}
						title={t("dashboard.pendingApproval")}
						value={canIncident ? counts[1] : "—"}
						loading={canIncident && statusCounts[1].isLoading}
						icon="solar:clipboard-check-bold-duotone"
						tone="info"
						onClick={canIncident ? () => navigate("/incidents?status=PENDING_APPROVAL") : undefined}
					/>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
				{/* Bản đồ thu nhỏ */}
				{showMap && (
					<Card className="xl:col-span-2 gap-0 overflow-hidden py-0">
						<CardHeader className="flex flex-row items-center justify-between py-4">
							<CardTitle className="flex items-center gap-2">
								{t("dashboard.liveMap")}
								{cameras.length > 0 && (
									<span className="text-xs font-normal text-text-secondary">
										· {t("dashboard.cameraCount", { count: cameras.length })}
									</span>
								)}
							</CardTitle>
							<Button variant="ghost" size="sm" onClick={() => navigate("/monitoring")}>
								{t("dashboard.openMap")}
								<Icon icon="solar:arrow-right-linear" size={16} />
							</Button>
						</CardHeader>
						<div className="h-[340px]">
							<BaseMap zoom={12} scrollWheelZoom={false}>
								<FitBounds points={points} fitKey={fitKey} maxZoom={14} />
								{vehicles.map((v) => (
									<Marker key={v.id} position={[v.latitude, v.longitude]} icon={vehicleIcon(v.state)} />
								))}
								{cameras.map((c) => {
									const link = liveLink(c);
									const direct = !link && /^rtsps?:\/\//i.test(c.source);
									return (
										<Marker
											key={`c${c.id}`}
											position={[c.latitude as number, c.longitude as number]}
											icon={cameraIcon(cameraState(c))}
										>
											<Popup>
												<div className="flex min-w-44 flex-col gap-1">
													<span className="font-semibold">{c.name}</span>
													{c.location && <span className="text-xs text-text-secondary">{c.location}</span>}
													<span className="text-xs text-text-secondary">
														{c.stations.length > 0
															? c.stations.map((l) => l.station_name ?? l.station_id).join(", ")
															: direct
																? t("aiCamera.liveViaServer")
																: t("aiCamera.liveNeedsStation")}
													</span>
													{(link || direct) && (
														<Button
															size="sm"
															className="mt-1"
															onClick={() => setLive({ camera: c, link: link ?? null })}
														>
															<Icon icon="solar:play-circle-bold" size={16} />
															{t("aiStation.live.open")}
														</Button>
													)}
												</div>
											</Popup>
										</Marker>
									);
								})}
							</BaseMap>
						</div>
					</Card>
				)}

				{/* Biểu đồ sự vụ */}
				{canIncident && (
					<Card className={showMap ? "" : "xl:col-span-3"}>
						<CardHeader>
							<CardTitle>{t("dashboard.incidentByStatus")}</CardTitle>
						</CardHeader>
						<CardContent>
							{totalIncidents > 0 ? (
								<Chart type="donut" series={counts} options={donut} height={300} />
							) : (
								<EmptyState text={t("dashboard.noIncident")} />
							)}
						</CardContent>
					</Card>
				)}
			</div>

			{/* Sự vụ mới nhất */}
			{canIncident && (
				<Card className="gap-2">
					<CardHeader className="flex flex-row items-center justify-between">
						<CardTitle>{t("dashboard.recentIncidents")}</CardTitle>
						<Button variant="ghost" size="sm" onClick={() => navigate("/incidents")}>
							{t("common.viewAll")}
							<Icon icon="solar:arrow-right-linear" size={16} />
						</Button>
					</CardHeader>
					<CardContent className="px-2 sm:px-4">
						{(recent.data?.data ?? []).length === 0 ? (
							<EmptyState text={t("dashboard.noIncident")} />
						) : (
							<ul className="divide-y">
								{recent.data?.data.map((i) => (
									<RecentRow key={i.id} incident={i} onClick={() => navigate(`/incidents/${i.id}`)} />
								))}
							</ul>
						)}
					</CardContent>
				</Card>
			)}
			{live && (
				<LiveViewModal
					station={live.link ? { id: live.link.station_id } : null}
					camera={{ id: live.link ? (live.link.remote_id ?? 0) : live.camera.id, name: live.camera.name }}
					open
					onClose={() => setLive(null)}
				/>
			)}
		</div>
	);
}

function RecentRow({ incident, onClick }: { incident: Incident; onClick: () => void }) {
	const { t } = useTranslation();
	return (
		<li>
			<button
				type="button"
				onClick={onClick}
				className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-action-hover"
			>
				<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-error/10 text-error">
					<Icon icon="solar:siren-rounded-bold-duotone" size={22} />
				</span>
				<div className="min-w-0 flex-1">
					<p className="font-medium truncate">{incident.name}</p>
					<p className="text-xs text-text-secondary truncate">
						{incident.location_address || incident.location || t("incident.noAddress")} ·{" "}
						{fmtFromNow(incident.created_at)}
					</p>
				</div>
				<div className="hidden sm:flex items-center gap-1 text-xs text-text-secondary">
					<Icon icon="solar:bus-linear" size={16} />
					{incident.dispatched_devices.length}
				</div>
				<IncidentStatusBadge status={incident.status} />
			</button>
		</li>
	);
}
