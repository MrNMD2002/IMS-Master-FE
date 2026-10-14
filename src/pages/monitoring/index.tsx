import { useQuery } from "@tanstack/react-query";
import { Input, Segmented, Select } from "antd";
import L, { type Map as LeafletMap } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Marker, Popup, useMapEvents } from "react-leaflet";
import { useNavigate, useSearchParams } from "react-router";
import type { Incident } from "#/ims";
import incidentService from "@/api/services/incidentService";
import { Icon } from "@/components/icon";
import AddressSearch from "@/components/ims/address-search";
import DispatchDialog from "@/components/ims/dispatch-dialog";
import EmptyState from "@/components/ims/empty-state";
import IncidentFormDrawer from "@/components/ims/incident-form-drawer";
import BaseMap from "@/components/ims/map/base-map";
import MapControls from "@/components/ims/map/map-controls";
import { incidentIcon, pickIcon, VEHICLE_COLOR, type VehicleState, vehicleIcon } from "@/components/ims/map/markers";
import OrgUnitFilter from "@/components/ims/org-unit-filter";
import { IncidentStatusBadge } from "@/components/ims/status";
import { INCIDENT_READ_GATE, P } from "@/constants/permission";
import { useDeviceTypes } from "@/hooks/use-ims-options";
import { type LiveVehicle, useLiveVehicles } from "@/hooks/use-live-vehicles";
import { useCan } from "@/store/userStore";
import { Button } from "@/ui/button";
import { cn } from "@/utils";
import { fmtFromNow, fmtSecondsAgo } from "@/utils/format";

type Tab = "vehicles" | "incidents";
type StateFilter = "all" | VehicleState;

function PickHandler({ active, onPick }: { active: boolean; onPick: (lat: number, lng: number) => void }) {
	useMapEvents({
		click: (e) => {
			if (active) onPick(e.latlng.lat, e.latlng.lng);
		},
	});
	return null;
}

export default function MonitoringPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const can = useCan();
	const [params, setParams] = useSearchParams();
	const mapRef = useRef<LeafletMap>(null);

	// Màn hình hẹp (điện thoại): mặc định thu bảng để thấy bản đồ.
	const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 768);
	const [tab, setTab] = useState<Tab>("vehicles");
	const [tenantId, setTenantId] = useState<number | undefined>();
	const [typeIds, setTypeIds] = useState<number[]>([]);
	const [stateFilter, setStateFilter] = useState<StateFilter>("all");
	const [search, setSearch] = useState("");
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [showLabels, setShowLabels] = useState(true);

	const [picking, setPicking] = useState(params.get("create") === "1");
	const [pickPoint, setPickPoint] = useState<{ lat: number; lng: number } | null>(null);
	const [formOpen, setFormOpen] = useState(false);
	const [dispatchFor, setDispatchFor] = useState<Incident | null>(null);

	const canIncident = can(...INCIDENT_READ_GATE);
	const canManage = can(P.INCIDENT_MANAGE);
	const { types } = useDeviceTypes();

	const { vehicles, dataUpdatedAt, refetch } = useLiveVehicles({
		tenant_id: tenantId,
		device_type: typeIds.length ? typeIds : undefined,
	});

	const activeIncidents = useQuery({
		queryKey: ["incident-active", tenantId],
		queryFn: async () => {
			const [a, b] = await Promise.all([
				incidentService.list({ status: "PROCESSING", page_size: 200, tenant_id: tenantId }),
				incidentService.list({ status: "PENDING_APPROVAL", page_size: 200, tenant_id: tenantId }),
			]);
			return [...a.data, ...b.data];
		},
		enabled: canIncident,
		refetchInterval: 15_000,
	});
	const incidents = (activeIncidents.data ?? []).filter((i) => i.lat && i.lng);

	const counts = useMemo(() => {
		const c = { all: vehicles.length, ready: 0, mobilized: 0, offline: 0 };
		for (const v of vehicles) c[v.state] += 1;
		return c;
	}, [vehicles]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return vehicles.filter(
			(v) =>
				(stateFilter === "all" || v.state === stateFilter) &&
				(!q || `${v.name ?? ""} ${v.imei}`.toLowerCase().includes(q)),
		);
	}, [vehicles, stateFilter, search]);

	// Lần đầu có dữ liệu → khung bản đồ ôm hết xe.
	const fitted = useRef(false);
	const fitAll = () => {
		const pts = [...vehicles.map((v) => [v.latitude, v.longitude]), ...incidents.map((i) => [i.lat, i.lng])] as [
			number,
			number,
		][];
		if (pts.length && mapRef.current) mapRef.current.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 15 });
	};
	// biome-ignore lint/correctness/useExhaustiveDependencies: chỉ chạy khi số xe đổi (lần đầu có dữ liệu)
	useEffect(() => {
		if (!fitted.current && vehicles.length && mapRef.current) {
			fitted.current = true;
			fitAll();
		}
	}, [vehicles.length]);

	const focus = (lat: number, lng: number, id?: number) => {
		mapRef.current?.flyTo([lat, lng], Math.max(mapRef.current.getZoom(), 16), { duration: 0.6 });
		if (id !== undefined) setSelectedId(id);
		if (window.innerWidth < 768) setPanelOpen(false);
	};

	const startPick = () => {
		setPicking(true);
		setPickPoint(null);
	};

	const onPicked = (lat: number, lng: number) => {
		setPickPoint({ lat, lng });
		setPicking(false);
		setFormOpen(true);
		if (params.get("create")) {
			params.delete("create");
			setParams(params, { replace: true });
		}
	};

	return (
		<div className="relative h-[calc(100vh-var(--layout-header-height))] w-full overflow-hidden">
			<BaseMap mapRef={mapRef} zoom={12}>
				<PickHandler active={picking} onPick={onPicked} />

				{filtered.map((v) => (
					<Marker
						key={v.id}
						position={[v.latitude, v.longitude]}
						icon={vehicleIcon(v.state, showLabels ? v.name || v.imei : null, v.id === selectedId)}
						eventHandlers={{ click: () => setSelectedId(v.id) }}
						zIndexOffset={v.id === selectedId ? 1000 : 0}
					>
						<Popup>
							<VehiclePopup
								v={v}
								onReplay={() => navigate(`/activity?device=${v.id}`)}
								onIncident={(id) => navigate(`/incidents/${id}`)}
							/>
						</Popup>
					</Marker>
				))}

				{incidents.map((i) => (
					<Marker
						key={`i-${i.id}`}
						position={[i.lat as number, i.lng as number]}
						icon={incidentIcon(i.status, i.has_active_devices)}
					>
						<Popup>
							<IncidentPopup
								incident={i}
								canManage={canManage}
								onOpen={() => navigate(`/incidents/${i.id}`)}
								onDispatch={() => setDispatchFor(i)}
							/>
						</Popup>
					</Marker>
				))}

				{pickPoint && formOpen && <Marker position={[pickPoint.lat, pickPoint.lng]} icon={pickIcon()} />}

				<MapControls onLocate={fitAll} />
			</BaseMap>

			{/* Thanh công cụ trên cùng */}
			<div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-wrap items-start justify-end gap-2">
				<div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-1.5 shadow-md backdrop-blur">
					<AddressSearch className="w-56 sm:w-72" onSelect={(r) => focus(r.lat, r.lng)} />
					{canManage && (
						<Button
							size="sm"
							variant={picking ? "destructive" : "default"}
							onClick={() => (picking ? setPicking(false) : startPick())}
						>
							<Icon icon={picking ? "solar:close-circle-bold" : "solar:add-circle-bold"} size={18} />
							{picking ? t("common.cancelText") : t("incident.create")}
						</Button>
					)}
				</div>
			</div>

			{picking && (
				<div className="absolute left-1/2 top-20 z-[500] -translate-x-1/2 rounded-full bg-error px-4 py-2 text-sm font-medium text-white shadow-lg">
					<Icon icon="solar:map-point-add-bold" size={18} className="mr-1 inline" />
					{t("monitor.pickHint")}
				</div>
			)}

			{/* Chú thích + giờ cập nhật */}
			<div className="absolute bottom-6 right-16 z-[500] hidden items-center gap-4 rounded-full border bg-background/95 px-4 py-1.5 text-xs shadow-md backdrop-blur md:flex">
				{(["ready", "mobilized", "offline"] as VehicleState[]).map((s) => (
					<span key={s} className="flex items-center gap-1.5">
						<span className="h-2.5 w-2.5 rounded-full" style={{ background: VEHICLE_COLOR[s] }} />
						{t(`monitor.state.${s}`)}
					</span>
				))}
				<span className="flex items-center gap-1.5">
					<Icon icon="solar:siren-rounded-bold" size={14} className="text-warning" />
					{t("sys.nav.incident")}
				</span>
				<span className="text-text-disabled">|</span>
				<button
					type="button"
					onClick={() => refetch()}
					className="flex items-center gap-1 text-text-secondary hover:text-primary"
				>
					<Icon icon="solar:refresh-linear" size={14} />
					{dataUpdatedAt ? fmtFromNow(dataUpdatedAt / 1000) : "—"}
				</button>
			</div>

			{/* Bảng bên trái */}
			<div
				className={cn(
					"absolute left-3 top-3 bottom-3 z-[600] flex w-[340px] max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-2xl border bg-background/95 shadow-xl backdrop-blur transition-transform duration-300",
					!panelOpen && "-translate-x-[calc(100%+12px)]",
				)}
			>
				<div className="flex items-center justify-between gap-2 border-b px-3 py-2">
					<Segmented
						value={tab}
						onChange={(v) => setTab(v as Tab)}
						options={[
							{ value: "vehicles", label: `${t("monitor.vehicles")} (${vehicles.length})` },
							...(canIncident ? [{ value: "incidents", label: `${t("sys.nav.incident")} (${incidents.length})` }] : []),
						]}
					/>
					<Button variant="ghost" size="icon" onClick={() => setPanelOpen(false)} title={t("monitor.hidePanel")}>
						<Icon icon="solar:double-alt-arrow-left-linear" size={18} />
					</Button>
				</div>

				{tab === "vehicles" ? (
					<>
						<div className="flex flex-col gap-2 border-b p-3">
							<Input
								allowClear
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								prefix={<Icon icon="solar:magnifer-linear" size={16} />}
								placeholder={t("monitor.searchVehicle")}
							/>
							<OrgUnitFilter size="small" value={tenantId} onChange={setTenantId} className="w-full [&>*]:flex-1" />
							<div className="grid grid-cols-1 gap-2">
								<Select
									size="small"
									mode="multiple"
									allowClear
									maxTagCount="responsive"
									placeholder={t("device.field.type")}
									value={typeIds}
									onChange={setTypeIds}
									options={types.map((d) => ({ value: d.id, label: d.name }))}
								/>
							</div>
							<div className="flex flex-wrap gap-1">
								{(["all", "ready", "mobilized", "offline"] as StateFilter[]).map((s) => (
									<button
										key={s}
										type="button"
										onClick={() => setStateFilter(s)}
										className={cn(
											"flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
											stateFilter === s
												? "border-primary bg-primary/10 text-primary font-semibold"
												: "hover:bg-action-hover",
										)}
									>
										{s !== "all" && <span className="h-2 w-2 rounded-full" style={{ background: VEHICLE_COLOR[s] }} />}
										{s === "all" ? t("common.all") : t(`monitor.state.${s}`)} ({counts[s]})
									</button>
								))}
							</div>
							<label className="flex items-center gap-2 text-xs text-text-secondary">
								<input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
								{t("monitor.showLabels")}
							</label>
						</div>
						<div className="flex-1 overflow-y-auto p-2">
							{filtered.length === 0 ? (
								<EmptyState text={t("monitor.noVehicle")} icon="solar:bus-bold-duotone" />
							) : (
								filtered.map((v) => (
									<VehicleRow
										key={v.id}
										v={v}
										selected={v.id === selectedId}
										onClick={() => focus(v.latitude, v.longitude, v.id)}
									/>
								))
							)}
						</div>
					</>
				) : (
					<div className="flex-1 overflow-y-auto p-2">
						{incidents.length === 0 ? (
							<EmptyState text={t("monitor.noActiveIncident")} icon="solar:shield-check-bold-duotone" />
						) : (
							incidents.map((i) => (
								<button
									key={i.id}
									type="button"
									onClick={() => focus(i.lat as number, i.lng as number)}
									className="flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left hover:bg-action-hover"
								>
									<div className="flex items-center justify-between gap-2">
										<span className="truncate font-medium">{i.name}</span>
										<IncidentStatusBadge status={i.status} />
									</div>
									<span className="truncate text-xs text-text-secondary">
										{i.location_address || i.location || "—"}
									</span>
									<span className="flex items-center gap-3 text-xs text-text-disabled">
										<span className="flex items-center gap-1">
											<Icon icon="solar:clock-circle-linear" size={13} />
											{fmtFromNow(i.created_at)}
										</span>
										<span className="flex items-center gap-1">
											<Icon icon="solar:bus-linear" size={13} />
											{i.dispatched_devices.filter((d) => !d.completed).length}/{i.dispatched_devices.length}
										</span>
									</span>
								</button>
							))
						)}
					</div>
				)}
			</div>

			{!panelOpen && (
				<Button
					className="absolute left-3 top-3 z-[600] shadow-md"
					variant="outline"
					size="sm"
					onClick={() => setPanelOpen(true)}
				>
					<Icon icon="solar:list-bold" size={18} />
					{t("monitor.showPanel")}
				</Button>
			)}

			<IncidentFormDrawer
				open={formOpen}
				onClose={() => {
					setFormOpen(false);
					setPickPoint(null);
				}}
				initialPoint={pickPoint}
				onSaved={(i) => i.lat && i.lng && focus(i.lat, i.lng)}
			/>
			<DispatchDialog incident={dispatchFor} open={!!dispatchFor} onClose={() => setDispatchFor(null)} />
		</div>
	);
}

function VehicleRow({ v, selected, onClick }: { v: LiveVehicle; selected: boolean; onClick: () => void }) {
	const { t } = useTranslation();
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
				selected ? "bg-primary/10" : "hover:bg-action-hover",
			)}
		>
			<span
				className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
				style={{ background: VEHICLE_COLOR[v.state] }}
			>
				<Icon icon="solar:bus-bold" size={18} />
			</span>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium">{v.name || v.imei}</p>
				<p className="truncate text-xs text-text-secondary">
					{v.tenant_name ?? v.device?.tenant_name ?? ""}
					{v.device?.device_type_name ? ` · ${v.device.device_type_name}` : ""}
				</p>
			</div>
			<div className="flex flex-col items-end text-[11px] text-text-secondary">
				<span>{t(`monitor.state.${v.state}`)}</span>
				<span>{fmtSecondsAgo(v.seconds_ago)}</span>
			</div>
		</button>
	);
}

function VehiclePopup({
	v,
	onReplay,
	onIncident,
}: {
	v: LiveVehicle;
	onReplay: () => void;
	onIncident: (id: number) => void;
}) {
	const { t } = useTranslation();
	const can = useCan();
	return (
		<div className="flex min-w-[220px] flex-col gap-2">
			<div className="flex items-center gap-2">
				<span className="h-2.5 w-2.5 rounded-full" style={{ background: VEHICLE_COLOR[v.state] }} />
				<span className="font-semibold">{v.name || v.imei}</span>
			</div>
			<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
				<dt className="text-text-secondary">IMEI</dt>
				<dd className="font-mono">{v.imei}</dd>
				{v.device?.device_type_name && (
					<>
						<dt className="text-text-secondary">{t("device.field.type")}</dt>
						<dd>{v.device.device_type_name}</dd>
					</>
				)}
				<dt className="text-text-secondary">{t("device.field.tenant")}</dt>
				<dd>{v.tenant_name ?? v.device?.tenant_name ?? "—"}</dd>
				<dt className="text-text-secondary">{t("monitor.speed")}</dt>
				<dd>{v.speed !== null && v.speed !== undefined ? `${v.speed.toFixed(0)} km/h` : "—"}</dd>
				<dt className="text-text-secondary">{t("monitor.lastSeen")}</dt>
				<dd>{fmtSecondsAgo(v.seconds_ago)}</dd>
				<dt className="text-text-secondary">{t("common.statusLabel")}</dt>
				<dd>{t(`monitor.state.${v.state}`)}</dd>
			</dl>
			<div className="flex flex-wrap gap-1.5">
				{can(P.DEVICE_ACTIVITY_READ) && (
					<Button size="sm" variant="outline" onClick={onReplay}>
						<Icon icon="solar:route-linear" size={16} />
						{t("monitor.replay")}
					</Button>
				)}
				{v.device?.current_incident_id && (
					<Button size="sm" onClick={() => onIncident(v.device?.current_incident_id as number)}>
						<Icon icon="solar:siren-rounded-linear" size={16} />
						{t("monitor.currentIncident")}
					</Button>
				)}
			</div>
		</div>
	);
}

function IncidentPopup({
	incident,
	canManage,
	onOpen,
	onDispatch,
}: {
	incident: Incident;
	canManage: boolean;
	onOpen: () => void;
	onDispatch: () => void;
}) {
	const { t } = useTranslation();
	return (
		<div className="flex min-w-[240px] flex-col gap-2">
			<div className="flex items-start justify-between gap-2">
				<span className="font-semibold">{incident.name}</span>
				<IncidentStatusBadge status={incident.status} />
			</div>
			<p className="text-xs text-text-secondary">{incident.location_address || incident.location || "—"}</p>
			<p className="text-xs">
				{t("incident.vehiclesOnSite", {
					active: incident.dispatched_devices.filter((d) => !d.completed).length,
					total: incident.dispatched_devices.length,
				})}{" "}
				· {fmtFromNow(incident.created_at)}
			</p>
			<div className="flex gap-1.5">
				<Button size="sm" variant="outline" onClick={onOpen}>
					{t("common.detail")}
				</Button>
				{canManage && incident.status !== "COMPLETED" && (
					<Button size="sm" onClick={onDispatch}>
						<Icon icon="solar:bus-linear" size={16} />
						{t("dispatch.title")}
					</Button>
				)}
			</div>
		</div>
	);
}
