import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image, Input, Modal, Popconfirm, Skeleton, Table, Timeline, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Marker, Popup } from "react-leaflet";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import type { DispatchedDevice, Incident, IncidentImage } from "#/ims";
import incidentService from "@/api/services/incidentService";
import { Icon } from "@/components/icon";
import DispatchDialog from "@/components/ims/dispatch-dialog";
import EmptyState from "@/components/ims/empty-state";
import IncidentFormDrawer from "@/components/ims/incident-form-drawer";
import BaseMap from "@/components/ims/map/base-map";
import FitBounds from "@/components/ims/map/fit-bounds";
import MapControls from "@/components/ims/map/map-controls";
import { incidentIcon, vehicleIcon } from "@/components/ims/map/markers";
import { IncidentStatusBadge } from "@/components/ims/status";
import { P } from "@/constants/permission";
import { useLiveVehicles } from "@/hooks/use-live-vehicles";
import { useCan } from "@/store/userStore";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { fmtDateTime, fmtFromNow } from "@/utils/format";

const LOG_ICON: Record<string, { icon: string; color: string }> = {
	received: { icon: "solar:inbox-in-bold", color: "#078DEE" },
	device_dispatch: { icon: "solar:bus-bold", color: "#FF7A00" },
	device_recall: { icon: "solar:undo-left-bold", color: "#FF5630" },
	device_complete: { icon: "solar:check-circle-bold", color: "#22C55E" },
	status_update: { icon: "solar:refresh-circle-bold", color: "#7635DC" },
	close: { icon: "solar:lock-keyhole-bold", color: "#637381" },
};

export default function IncidentDetailPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const can = useCan();
	const id = Number(useParams().id);
	const canManage = can(P.INCIDENT_MANAGE);

	const [editOpen, setEditOpen] = useState(false);
	const [dispatchOpen, setDispatchOpen] = useState(false);
	const [completeFor, setCompleteFor] = useState<DispatchedDevice | null>(null);

	const { data: incident, isLoading } = useQuery({
		queryKey: ["incident-detail", id],
		queryFn: () => incidentService.detail(id),
		refetchInterval: 15_000,
		enabled: !!id,
	});
	const logs = useQuery({
		queryKey: ["incident-logs", id],
		queryFn: () => incidentService.logs(id),
		refetchInterval: 15_000,
		enabled: !!id,
	});

	const refresh = () => {
		qc.invalidateQueries({ queryKey: ["incident-detail", id] });
		qc.invalidateQueries({ queryKey: ["incident-logs", id] });
		qc.invalidateQueries({ queryKey: ["incident"] });
		qc.invalidateQueries({ queryKey: ["device-all"] });
	};

	const finish = useMutation({
		mutationFn: () => incidentService.setStatus(id, "COMPLETED"),
		onSuccess: () => {
			toast.success(t("incident.finished"));
			refresh();
		},
	});
	const remove = useMutation({
		mutationFn: () => incidentService.remove(id),
		onSuccess: () => {
			toast.success(t("common.deleted"));
			qc.invalidateQueries({ queryKey: ["incident"] });
			navigate("/incidents", { replace: true });
		},
	});
	const recall = useMutation({
		mutationFn: (deviceId: number) => incidentService.recall(id, [deviceId]),
		onSuccess: () => {
			toast.success(t("dispatch.recalled"));
			refresh();
		},
	});

	if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
	if (!incident) return <EmptyState text={t("incident.notFound")} />;

	const done = incident.status === "COMPLETED";
	const activeCount = incident.dispatched_devices.filter((d) => !d.completed).length;

	const confirmFinish = () =>
		Modal.confirm({
			title: incident.status === "PENDING_APPROVAL" ? t("incident.approveTitle") : t("incident.finishTitle"),
			content: activeCount > 0 ? t("incident.finishWarn", { count: activeCount }) : t("incident.finishDesc"),
			okText: t("common.confirmText"),
			cancelText: t("common.cancelText"),
			onOk: () => finish.mutateAsync(),
		});

	const deviceColumns: ColumnsType<DispatchedDevice> = [
		{
			title: t("incident.vehicle"),
			key: "device",
			render: (_, d) => (
				<div className="min-w-[160px]">
					<p className="font-medium">{d.device_name || d.imei}</p>
					<p className="text-xs text-text-secondary font-mono">{d.imei}</p>
				</div>
			),
		},
		{
			title: t("incident.officer"),
			dataIndex: "gps_user_name",
			render: (v) => v || <span className="text-text-disabled">{t("incident.noOfficer")}</span>,
		},
		{
			title: t("common.statusLabel"),
			key: "status",
			render: (_, d) =>
				d.completed ? (
					<Tooltip title={fmtDateTime(d.completed_at)}>
						<Badge variant="success">{t("incident.deviceDone")}</Badge>
					</Tooltip>
				) : d.confirmed ? (
					<Badge variant="info">{t("incident.deviceConfirmed")}</Badge>
				) : (
					<Badge variant="warning">{t("incident.deviceDispatched")}</Badge>
				),
		},
		{ title: t("incident.field.note"), dataIndex: "note", render: (v) => v || "—" },
		...(canManage && !done
			? [
					{
						key: "actions",
						align: "right" as const,
						render: (_: unknown, d: DispatchedDevice) =>
							!d.completed && (
								<div className="flex justify-end gap-1">
									<Button size="sm" variant="outline" onClick={() => setCompleteFor(d)}>
										<Icon icon="solar:check-circle-linear" size={16} />
										{t("incident.completeDevice")}
									</Button>
									<Popconfirm
										title={t("dispatch.recallConfirm", { name: d.device_name || d.imei })}
										okText={t("dispatch.recall")}
										cancelText={t("common.cancelText")}
										okButtonProps={{ danger: true }}
										onConfirm={() => recall.mutateAsync(d.device_id)}
									>
										<Button size="sm" variant="ghost" className="text-error">
											<Icon icon="solar:undo-left-linear" size={16} />
											{t("dispatch.recall")}
										</Button>
									</Popconfirm>
								</div>
							),
					},
				]
			: []),
	];

	return (
		<div className="flex flex-col gap-4">
			{/* Đầu trang */}
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex items-start gap-3 min-w-0">
					<Button variant="outline" size="icon" onClick={() => navigate("/incidents")} title={t("common.back")}>
						<Icon icon="solar:arrow-left-linear" size={18} />
					</Button>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="text-xl font-bold">{incident.name}</h1>
							<IncidentStatusBadge status={incident.status} />
						</div>
						<p className="text-sm text-text-secondary">
							#{incident.id} · {t("common.createdAt")} {fmtDateTime(incident.created_at)} (
							{fmtFromNow(incident.created_at)})
						</p>
					</div>
				</div>
				{canManage && (
					<div className="flex flex-wrap gap-2">
						{!done && (
							<>
								<Button variant="outline" onClick={() => setEditOpen(true)}>
									<Icon icon="solar:pen-linear" size={18} />
									{t("common.editText")}
								</Button>
								<Button variant="outline" onClick={() => setDispatchOpen(true)} disabled={!incident.lat}>
									<Icon icon="solar:bus-linear" size={18} />
									{t("dispatch.title")}
								</Button>
								<Button onClick={confirmFinish}>
									<Icon icon="solar:check-read-linear" size={18} />
									{incident.status === "PENDING_APPROVAL" ? t("incident.approve") : t("incident.finish")}
								</Button>
							</>
						)}
						{incident.status === "PROCESSING" && incident.dispatched_devices.length === 0 && (
							<Popconfirm
								title={t("common.deleteConfirm")}
								okText={t("common.delText")}
								cancelText={t("common.cancelText")}
								okButtonProps={{ danger: true }}
								onConfirm={() => remove.mutateAsync()}
							>
								<Button variant="ghost" className="text-error">
									<Icon icon="solar:trash-bin-trash-linear" size={18} />
								</Button>
							</Popconfirm>
						)}
					</div>
				)}
			</div>

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
				<div className="flex flex-col gap-4 xl:col-span-2">
					<Card className="gap-4">
						<CardHeader>
							<CardTitle>{t("incident.info")}</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
								<Field icon="solar:map-point-linear" label={t("incident.field.address")} wide>
									{incident.location_address || incident.location || "—"}
								</Field>
								<Field icon="solar:document-text-linear" label={t("incident.field.description")} wide>
									<span className="whitespace-pre-wrap">{incident.description || "—"}</span>
								</Field>
								<Field icon="solar:user-linear" label={t("incident.field.reporter")}>
									{incident.name_reporter || "—"}
								</Field>
								<Field icon="solar:phone-linear" label={t("incident.field.phone")}>
									{incident.phone_number_reporter ? (
										<a className="text-primary" href={`tel:${incident.phone_number_reporter}`}>
											{incident.phone_number_reporter}
										</a>
									) : (
										"—"
									)}
								</Field>
								<Field icon="solar:buildings-2-linear" label={t("incident.field.tenant")}>
									{incident.tenant_name || "—"}
								</Field>
								<Field icon="solar:user-id-linear" label={t("incident.createdBy")}>
									{incident.created_by?.full_name || incident.created_by?.username || "—"}
								</Field>
								{incident.note && (
									<Field icon="solar:notes-linear" label={t("incident.field.note")} wide>
										{incident.note}
									</Field>
								)}
								{incident.closed_at && (
									<Field icon="solar:lock-keyhole-linear" label={t("incident.closedAt")}>
										{fmtDateTime(incident.closed_at)}
									</Field>
								)}
							</dl>
						</CardContent>
					</Card>

					<Card className="gap-3">
						<CardHeader className="flex flex-row items-center justify-between">
							<CardTitle>
								{t("incident.dispatchedVehicles")} ({activeCount}/{incident.dispatched_devices.length})
							</CardTitle>
						</CardHeader>
						<CardContent className="px-2 sm:px-6">
							<Table
								rowKey="id"
								size="small"
								pagination={false}
								scroll={{ x: "max-content" }}
								columns={deviceColumns}
								dataSource={incident.dispatched_devices}
								locale={{ emptyText: <EmptyState text={t("incident.noVehicle")} icon="solar:bus-bold-duotone" /> }}
							/>
						</CardContent>
					</Card>

					<ImagesCard incident={incident} canManage={canManage} onChanged={refresh} />
				</div>

				<div className="flex flex-col gap-4">
					<Card className="gap-0 overflow-hidden py-0">
						<div className="h-[300px]">
							<IncidentMap incident={incident} />
						</div>
					</Card>

					<Card className="gap-3">
						<CardHeader>
							<CardTitle>{t("incident.logs")}</CardTitle>
						</CardHeader>
						<CardContent>
							{(logs.data ?? []).length === 0 ? (
								<EmptyState text={t("incident.noLogs")} icon="solar:history-bold-duotone" />
							) : (
								<Timeline
									items={(logs.data ?? []).map((l) => {
										const meta = LOG_ICON[l.action ?? ""] ?? { icon: "solar:record-circle-bold", color: "#919EAB" };
										return {
											dot: <Icon icon={meta.icon} size={18} color={meta.color} />,
											children: (
												<div className="pb-1">
													<p className="text-sm font-medium">
														{t(`incident.log.${l.action}`, { defaultValue: l.action ?? "" })}
													</p>
													{l.note && <p className="text-xs text-text-secondary">{l.note}</p>}
													<p className="text-xs text-text-disabled">
														{l.actor_full_name || l.actor_username || t("incident.system")} ·{" "}
														{fmtDateTime(l.created_at)}
													</p>
												</div>
											),
										};
									})}
								/>
							)}
						</CardContent>
					</Card>
				</div>
			</div>

			<IncidentFormDrawer open={editOpen} onClose={() => setEditOpen(false)} incident={incident} />
			<DispatchDialog incident={incident} open={dispatchOpen} onClose={() => setDispatchOpen(false)} />
			<CompleteDeviceModal incidentId={id} device={completeFor} onClose={() => setCompleteFor(null)} onDone={refresh} />
		</div>
	);
}

function Field({ icon, label, children, wide }: { icon: string; label: string; children: ReactNode; wide?: boolean }) {
	return (
		<div className={wide ? "sm:col-span-2" : ""}>
			<dt className="mb-0.5 flex items-center gap-1.5 text-xs text-text-secondary">
				<Icon icon={icon} size={15} />
				{label}
			</dt>
			<dd className="text-sm">{children}</dd>
		</div>
	);
}

/** Bản đồ hiện trường + vị trí hiện tại của các xe đang làm nhiệm vụ. */
function IncidentMap({ incident }: { incident: Incident }) {
	const { t } = useTranslation();
	const can = useCan();
	const { vehicles } = useLiveVehicles({}, can(P.GPS_READ));
	const activeIds = new Set(incident.dispatched_devices.filter((d) => !d.completed).map((d) => d.device_id));
	const onDuty = vehicles.filter((v) => activeIds.has(v.id));
	const hasPos = !!(incident.lat && incident.lng);
	const points = useMemo<[number, number][]>(
		() => [
			...(hasPos ? [[incident.lat, incident.lng] as [number, number]] : []),
			...onDuty.map((v) => [v.latitude, v.longitude] as [number, number]),
		],
		[hasPos, incident.lat, incident.lng, onDuty],
	);

	if (!hasPos) return <EmptyState text={t("incident.noLocation")} icon="solar:map-point-remove-bold-duotone" />;

	return (
		<BaseMap center={[incident.lat as number, incident.lng as number]} zoom={15}>
			<Marker
				position={[incident.lat as number, incident.lng as number]}
				icon={incidentIcon(incident.status, incident.has_active_devices)}
			/>
			{onDuty.map((v) => (
				<Marker key={v.id} position={[v.latitude, v.longitude]} icon={vehicleIcon(v.state, v.name || v.imei)}>
					<Popup>{v.name || v.imei}</Popup>
				</Marker>
			))}
			<FitBounds points={points} />
			<MapControls className="right-2 bottom-4" />
		</BaseMap>
	);
}

function ImagesCard({
	incident,
	canManage,
	onChanged,
}: {
	incident: Incident;
	canManage: boolean;
	onChanged: () => void;
}) {
	const { t } = useTranslation();
	const [urls, setUrls] = useState<Record<number, string>>({});
	const images = incident.images ?? [];
	const ids = images.map((i) => i.id).join(",");

	// Ảnh lấy kèm token → blob URL; thu hồi URL khi rời trang.
	// biome-ignore lint/correctness/useExhaustiveDependencies: tải lại khi danh sách ảnh đổi
	useEffect(() => {
		let alive = true;
		const created: string[] = [];
		Promise.all(
			images.map(async (img) => {
				try {
					const url = await incidentService.imageBlobUrl(incident.id, img.id);
					created.push(url);
					return [img.id, url] as const;
				} catch {
					return [img.id, ""] as const;
				}
			}),
		).then((pairs) => alive && setUrls(Object.fromEntries(pairs)));
		return () => {
			alive = false;
			for (const u of created) URL.revokeObjectURL(u);
		};
	}, [incident.id, ids]);

	const del = useMutation({
		mutationFn: (img: IncidentImage) => incidentService.deleteImage(incident.id, img.id),
		onSuccess: () => {
			toast.success(t("common.deleted"));
			onChanged();
		},
	});

	const deviceName = (deviceId?: number | null) =>
		incident.dispatched_devices.find((d) => d.device_id === deviceId)?.device_name ?? "";

	return (
		<Card className="gap-3">
			<CardHeader>
				<CardTitle>
					{t("incident.images")} ({images.length})
				</CardTitle>
			</CardHeader>
			<CardContent>
				{images.length === 0 ? (
					<EmptyState text={t("incident.noImages")} icon="solar:gallery-bold-duotone" />
				) : (
					<Image.PreviewGroup>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
							{images.map((img) => (
								<div key={img.id} className="group relative overflow-hidden rounded-xl border">
									{urls[img.id] ? (
										<Image
											src={urls[img.id]}
											alt={img.file_name ?? ""}
											className="aspect-square object-cover"
											width="100%"
										/>
									) : (
										<div className="flex aspect-square items-center justify-center bg-secondary">
											<Icon icon="svg-spinners:180-ring" size={24} />
										</div>
									)}
									<div className="px-2 py-1.5 text-[11px] text-text-secondary">
										<p className="truncate">{deviceName(img.device_id) || img.file_name}</p>
										<p>{fmtDateTime(img.created_at)}</p>
									</div>
									{canManage && (
										<Popconfirm
											title={t("common.deleteConfirm")}
											okText={t("common.delText")}
											cancelText={t("common.cancelText")}
											okButtonProps={{ danger: true }}
											onConfirm={() => del.mutateAsync(img)}
										>
											<button
												type="button"
												className="absolute right-1.5 top-1.5 hidden rounded-full bg-black/60 p-1.5 text-white group-hover:block"
											>
												<Icon icon="solar:trash-bin-trash-linear" size={14} />
											</button>
										</Popconfirm>
									)}
								</div>
							))}
						</div>
					</Image.PreviewGroup>
				)}
			</CardContent>
		</Card>
	);
}

function CompleteDeviceModal({
	incidentId,
	device,
	onClose,
	onDone,
}: {
	incidentId: number;
	device: DispatchedDevice | null;
	onClose: () => void;
	onDone: () => void;
}) {
	const { t } = useTranslation();
	const [note, setNote] = useState("");
	// biome-ignore lint/correctness/useExhaustiveDependencies: xoá ghi chú khi đổi xe
	useEffect(() => setNote(""), [device]);
	const complete = useMutation({
		mutationFn: () => incidentService.completeDevice(incidentId, device?.device_id as number, note.trim() || undefined),
		onSuccess: () => {
			toast.success(t("incident.deviceCompleted"));
			onDone();
			onClose();
		},
	});
	return (
		<Modal
			open={!!device}
			onCancel={onClose}
			title={t("incident.completeDeviceTitle", { name: device?.device_name || device?.imei })}
			okText={t("common.confirmText")}
			cancelText={t("common.cancelText")}
			onOk={() => complete.mutate()}
			okButtonProps={{ loading: complete.isPending }}
			destroyOnHidden
		>
			<p className="mb-3 text-sm text-text-secondary">{t("incident.completeDeviceDesc")}</p>
			<Input.TextArea
				value={note}
				onChange={(e) => setNote(e.target.value)}
				placeholder={t("incident.field.note")}
				autoSize={{ minRows: 2 }}
			/>
		</Modal>
	);
}
