import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input, Popconfirm, Select, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { Camera, CameraStationLink } from "#/camera";
import aiStationService from "@/api/services/aiStationService";
import cameraService from "@/api/services/cameraService";
import EmptyState from "@/components/cmc/empty-state";
import OrgUnitFilter from "@/components/cmc/org-unit-filter";
import PageHeader from "@/components/cmc/page-header";
import StatCard from "@/components/cmc/stat-card";
import { Icon } from "@/components/icon";
import { AI_STATION_MANAGE } from "@/constants/permission";
import { useCan } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { cn } from "@/utils";
import { LiveViewModal } from "../ai-station/components/live-view";
import { AssignModal, CameraFormModal, reportPushed } from "./camera-modals";

const STATE_DOT: Record<string, string> = {
	live: "bg-success",
	connecting: "bg-warning",
	error: "bg-error",
	off: "bg-text-disabled",
};

/** Lần gán xem trực tiếp được: trạm online, trạm đã nhận camera, camera đang bật. */
const watchable = (l: CameraStationLink) => l.station_online && l.remote_id !== null && l.enabled !== false;

/**
 * Danh mục camera tập trung (học từ quản lý camera + gán camera cho AI agent của hệ tham khảo):
 * thêm camera RTSP trên CMC rồi gán cho một hay nhiều trạm AI xử lý; camera thêm trên trạm Vigil
 * tự vào danh mục.
 */
export default function AiCameraPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const can = useCan();
	const canManage = can(AI_STATION_MANAGE);

	const [search, setSearch] = useState("");
	const [keyword, setKeyword] = useState("");
	const [tenantId, setTenantId] = useState<number | undefined>();
	const [stationId, setStationId] = useState<string | undefined>();
	const [editing, setEditing] = useState<Camera | null | undefined>(undefined);
	const [assigning, setAssigning] = useState<Camera | null>(null);
	const [live, setLive] = useState<{ camera: Camera; link: CameraStationLink } | null>(null);

	const { data, isFetching, refetch } = useQuery({
		queryKey: ["camera", "list", keyword, tenantId, stationId],
		queryFn: () =>
			cameraService.list({
				page: 1,
				page_size: 200,
				search: keyword || undefined,
				tenant_id: tenantId,
				station_id: stationId,
			}),
		placeholderData: keepPreviousData,
		refetchInterval: 30_000,
	});
	const stations = useQuery({
		queryKey: ["ai-station", "list", "camera-filter"],
		queryFn: () => aiStationService.listStations({ page: 1, page_size: 200 }),
	});
	const cameras = data?.data ?? [];
	const assigned = cameras.filter((c) => c.stations.length > 0).length;
	const running = cameras.filter((c) => c.stations.some((l) => l.state === "live")).length;
	const broken = cameras.filter((c) => c.stations.some((l) => l.state === "error")).length;

	const done = () => {
		qc.invalidateQueries({ queryKey: ["camera"] });
		qc.invalidateQueries({ queryKey: ["ai-station"] });
	};
	const unassign = useMutation({
		mutationFn: ({ camera, station }: { camera: Camera; station: string }) =>
			cameraService.unassign(camera.id, station),
		onSuccess: (r) => {
			done();
			reportPushed(r.pushed, t("aiCamera.unassigned"));
		},
	});
	const remove = useMutation({
		mutationFn: (c: Camera) => cameraService.remove(c.id),
		onSuccess: () => {
			done();
			toast.success(t("aiCamera.deleted"));
		},
	});

	const columns: ColumnsType<Camera> = [
		{
			title: t("aiCamera.field.name"),
			dataIndex: "name",
			render: (_, c) => (
				<div className="flex min-w-[240px] items-center gap-3">
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
						<Icon icon="solar:videocamera-record-bold-duotone" size={20} />
					</span>
					<div className="min-w-0">
						<p className="truncate font-medium">{c.name}</p>
						<p className="max-w-[320px] truncate font-mono text-xs text-text-secondary" title={c.source}>
							{c.source}
						</p>
						{c.location && <p className="truncate text-xs text-text-secondary">{c.location}</p>}
					</div>
				</div>
			),
		},
		{
			title: t("aiCamera.field.tenant"),
			dataIndex: "tenant_name",
			render: (v) => v ?? "—",
		},
		{
			title: t("aiCamera.field.origin"),
			dataIndex: "origin",
			render: (o: Camera["origin"]) => (
				<Tooltip title={t(`aiCamera.originHint.${o}`)}>
					<Tag className="m-0" color={o === "cmc" ? "blue" : "purple"}>
						{t(`aiCamera.origin.${o}`)}
					</Tag>
				</Tooltip>
			),
		},
		{
			title: t("aiCamera.field.stations"),
			key: "stations",
			render: (_, c) =>
				c.stations.length ? (
					<div className="flex max-w-[380px] flex-wrap gap-1.5">
						{c.stations.map((l) => (
							<Tooltip
								key={l.station_id}
								title={
									<div className="text-xs">
										<div>
											{l.station_online ? t("aiCamera.link.online") : t("aiCamera.link.offline")}
											{l.remote_id === null && ` · ${t("aiCamera.link.pending")}`}
										</div>
										{l.resolution && <div>{`${l.resolution}${l.fps ? ` · ${l.fps} fps` : ""}`}</div>}
										<div>{l.plugins.length ? l.plugins.join(", ") : t("aiStation.cam.noPlugin")}</div>
									</div>
								}
							>
								<Tag
									className="m-0 inline-flex cursor-pointer items-center gap-1.5"
									closable={canManage}
									onClick={() => navigate(`/ai/stations/${l.station_id}`)}
									onClose={(e) => {
										e.preventDefault();
										e.stopPropagation();
										unassign.mutate({ camera: c, station: l.station_id });
									}}
								>
									<span
										className={cn(
											"h-2 w-2 rounded-full",
											l.station_online ? (STATE_DOT[l.state ?? "off"] ?? STATE_DOT.off) : "bg-text-disabled",
										)}
									/>
									{l.station_name ?? l.station_id}
									{l.plugins.length > 0 && <span className="text-text-secondary">· {l.plugins.length}</span>}
								</Tag>
							</Tooltip>
						))}
					</div>
				) : (
					<span className="text-text-disabled">{t("aiCamera.notAssigned")}</span>
				),
		},
		{
			key: "actions",
			fixed: "right",
			width: 168,
			render: (_, c) => {
				const link = c.stations.find(watchable);
				return (
					<div className="flex items-center justify-end gap-1">
						<Tooltip title={link ? t("aiStation.live.open") : t("aiCamera.liveNeedsStation")}>
							<Button
								variant="ghost"
								size="icon"
								disabled={!link}
								onClick={() => link && setLive({ camera: c, link })}
								aria-label={t("aiStation.live.open")}
							>
								<Icon icon="solar:play-circle-linear" size={18} />
							</Button>
						</Tooltip>
						{canManage && (
							<>
								<Tooltip title={t("aiCamera.assign.action")}>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => setAssigning(c)}
										aria-label={t("aiCamera.assign.action")}
									>
										<Icon icon="solar:link-round-angle-linear" size={18} />
									</Button>
								</Tooltip>
								<Tooltip title={t("common.editText")}>
									<Button variant="ghost" size="icon" onClick={() => setEditing(c)} aria-label={t("common.editText")}>
										<Icon icon="solar:pen-linear" size={18} />
									</Button>
								</Tooltip>
								<Popconfirm
									title={t("aiCamera.deleteConfirm", { name: c.name })}
									description={c.stations.length ? t("aiCamera.deleteHint", { n: c.stations.length }) : undefined}
									okText={t("common.delText")}
									cancelText={t("common.cancelText")}
									okButtonProps={{ danger: true }}
									onConfirm={() => remove.mutateAsync(c)}
								>
									<Button variant="ghost" size="icon" aria-label={t("common.delText")}>
										<Icon icon="solar:trash-bin-trash-linear" size={18} className="text-error" />
									</Button>
								</Popconfirm>
							</>
						)}
					</div>
				);
			},
		},
	];

	const filtered = !!(keyword || tenantId || stationId);

	return (
		<>
			<PageHeader
				icon="solar:videocamera-record-bold-duotone"
				title={t("sys.nav.aiCamera")}
				description={t("aiCamera.description")}
				actions={
					<>
						<Button variant="outline" onClick={() => refetch()}>
							<Icon icon="solar:refresh-linear" size={18} />
							{t("common.refresh")}
						</Button>
						{canManage && (
							<Button onClick={() => setEditing(null)}>
								<Icon icon="solar:add-circle-bold" size={18} />
								{t("aiCamera.create")}
							</Button>
						)}
					</>
				}
				toolbar={
					<>
						<Input.Search
							allowClear
							className="max-w-xs"
							placeholder={t("aiCamera.searchPlaceholder")}
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								if (!e.target.value) setKeyword("");
							}}
							onSearch={(v) => setKeyword(v.trim())}
						/>
						<OrgUnitFilter value={tenantId} onChange={setTenantId} />
						<Select
							allowClear
							showSearch
							className="min-w-[200px]"
							placeholder={t("aiCamera.filterStation")}
							value={stationId}
							onChange={setStationId}
							optionFilterProp="label"
							options={[
								{ value: "none", label: t("aiCamera.notAssigned") },
								...(stations.data?.data ?? []).map((s) => ({ value: s.id, label: s.name })),
							]}
						/>
					</>
				}
			/>

			<div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
				<StatCard
					title={t("aiCamera.summary.total")}
					value={data ? cameras.length : undefined}
					icon="solar:videocamera-record-bold-duotone"
					tone="info"
					loading={!data}
				/>
				<StatCard
					title={t("aiCamera.summary.assigned")}
					value={data ? `${assigned}/${cameras.length}` : undefined}
					icon="solar:link-round-angle-bold-duotone"
					tone="success"
					loading={!data}
				/>
				<StatCard
					title={t("aiCamera.summary.running")}
					value={data ? running : undefined}
					icon="solar:play-circle-bold-duotone"
					tone="success"
					loading={!data}
				/>
				<StatCard
					title={t("aiCamera.summary.error")}
					value={data ? broken : undefined}
					icon="solar:danger-triangle-bold-duotone"
					tone="error"
					loading={!data}
				/>
			</div>

			<Card className="gap-0 py-5">
				<CardContent className="px-4 sm:px-6">
					<Table
						rowKey="id"
						size="middle"
						scroll={{ x: "max-content" }}
						loading={isFetching && !data}
						columns={columns}
						dataSource={cameras}
						locale={{ emptyText: <EmptyState text={t(filtered ? "aiCamera.emptyFiltered" : "aiCamera.empty")} /> }}
						pagination={
							cameras.length > 20 ? { pageSize: 20, showTotal: (n) => t("common.totalItems", { total: n }) } : false
						}
					/>
				</CardContent>
			</Card>

			<CameraFormModal camera={editing} onClose={() => setEditing(undefined)} />
			<AssignModal camera={assigning} onClose={() => setAssigning(null)} />
			{live && (
				<LiveViewModal
					station={{ id: live.link.station_id }}
					camera={{ id: live.link.remote_id ?? 0, name: live.camera.name }}
					open
					onClose={() => setLive(null)}
				/>
			)}
		</>
	);
}
