import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Descriptions, Skeleton, Table, Tabs, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import type { AiStationWithToken, PluginInfo, StationCamera } from "#/vigil";
import aiStationService from "@/api/services/aiStationService";
import EmptyState from "@/components/cmc/empty-state";
import { STICKY_PAGE_BAR } from "@/components/cmc/page-header";
import { Icon } from "@/components/icon";
import { AI_STATION_MANAGE } from "@/constants/permission";
import { useCan } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { cn } from "@/utils";
import { fmtDateTime } from "@/utils/format";
import { eventTypeLabel, pluginLabel } from "../ai-event/components/event-meta";
import EventTable from "../ai-event/components/event-table";
import { PairingTokenModal, StationFormModal } from "./components/station-modals";
import {
	AccelLabel,
	CameraStateBadge,
	MockNotice,
	StationOnline,
	StationStateBadge,
	stationState,
	UsageBar,
} from "./components/station-status";

/** Chi tiết một trạm AI: thông tin, tài nguyên, camera, plugin, sự kiện. */
export default function AiStationDetailPage() {
	const { t } = useTranslation();
	const { modal } = App.useApp();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const can = useCan();
	const canManage = can(AI_STATION_MANAGE);
	const id = useParams().id as string;

	const [editing, setEditing] = useState(false);
	const [token, setToken] = useState<AiStationWithToken | null>(null);
	const [tab, setTab] = useState("cameras");

	const { data: st, isLoading } = useQuery({
		queryKey: ["ai-station", "detail", id],
		queryFn: () => aiStationService.getStation(id),
		refetchInterval: 15_000,
		enabled: !!id,
	});

	const rotate = useMutation({
		mutationFn: () => aiStationService.rotateToken(id),
		onSuccess: (r) => {
			qc.invalidateQueries({ queryKey: ["ai-station"] });
			setToken(r);
		},
	});
	const remove = useMutation({
		mutationFn: () => aiStationService.deleteStation(id),
		onSuccess: () => {
			toast.success(t("common.deleted"));
			qc.invalidateQueries({ queryKey: ["ai-station"] });
			qc.invalidateQueries({ queryKey: ["ai-event"] });
			navigate("/ai/stations", { replace: true });
		},
	});

	if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
	if (!st) return <EmptyState text={t("aiStation.notFound")} />;

	const state = stationState(st);
	const pluginName = (n: string) => st.plugins.find((p) => p.name === n)?.display_name ?? pluginLabel(t, n);

	const confirmRotate = () =>
		modal.confirm({
			title: t("aiStation.rotateConfirm", { name: st.name }),
			content: t("aiStation.rotateDesc"),
			okText: t("aiStation.rotate"),
			cancelText: t("common.cancelText"),
			onOk: () => rotate.mutateAsync(),
		});
	const confirmDelete = () =>
		modal.confirm({
			title: t("aiStation.deleteConfirm", { name: st.name }),
			content: t("aiStation.deleteDesc"),
			okText: t("common.delText"),
			cancelText: t("common.cancelText"),
			okButtonProps: { danger: true },
			onOk: () => remove.mutateAsync(),
		});

	const cameraColumns: ColumnsType<StationCamera> = [
		{
			title: t("aiStation.cam.name"),
			dataIndex: "name",
			render: (_, c) => (
				<div className="flex items-center gap-3">
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-text-secondary">
						<Icon icon="solar:videocamera-record-bold-duotone" size={20} />
					</span>
					<div>
						<p className="font-medium">{c.name}</p>
						<p className="text-xs text-text-secondary">#{c.id}</p>
					</div>
				</div>
			),
		},
		{ title: t("common.statusLabel"), dataIndex: "state", render: (s) => <CameraStateBadge state={s} /> },
		{
			title: "FPS",
			dataIndex: "fps",
			align: "right",
			render: (v: number, c) => (
				<span className="font-mono tabular-nums">{c.state === "live" ? v.toFixed(1) : "—"}</span>
			),
		},
		{
			title: t("aiStation.cam.resolution"),
			dataIndex: "resolution",
			render: (v) => <span className="font-mono text-sm">{v.replace("x", " × ")}</span>,
		},
		{
			title: t("aiStation.cam.plugins"),
			dataIndex: "plugins",
			render: (ps: string[]) =>
				ps.length ? (
					<span className="flex flex-wrap gap-1">
						{ps.map((p) => {
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
					<span className="text-sm text-text-disabled">{t("aiStation.cam.noPlugin")}</span>
				),
		},
	];

	const pluginColumns: ColumnsType<PluginInfo> = [
		{
			title: t("aiStation.plugin.displayName"),
			dataIndex: "display_name",
			render: (_, p) => (
				<div className="min-w-[200px] max-w-[380px]">
					<p className="font-medium">{p.display_name}</p>
					<p className="font-mono text-xs text-text-secondary">{p.name}</p>
					{p.description && <p className="mt-0.5 text-xs text-text-secondary">{p.description}</p>}
				</div>
			),
		},
		{
			title: t("common.statusLabel"),
			dataIndex: "enabled",
			render: (on: boolean) =>
				on ? <Tag color="success">{t("aiStation.plugin.on")}</Tag> : <Tag>{t("aiStation.plugin.off")}</Tag>,
		},
		{
			title: t("aiStation.field.version"),
			dataIndex: "version",
			render: (v) => <span className="font-mono text-sm">v{v}</span>,
		},
		{
			title: t("aiStation.plugin.model"),
			dataIndex: "model",
			render: (v) => (v ? <span className="font-mono text-xs">{v}</span> : "—"),
		},
		{
			title: t("aiStation.plugin.eventTypes"),
			dataIndex: "event_types",
			render: (ts: string[]) => (
				<span className="flex flex-wrap gap-1">
					{ts.map((x) => (
						<Tag key={x} className="m-0">
							{eventTypeLabel(t, x)}
						</Tag>
					))}
				</span>
			),
		},
		{
			title: t("aiStation.plugin.usedBy"),
			key: "cams",
			align: "right",
			render: (_, p) => st.cameras.filter((c) => c.plugins.includes(p.name)).length,
		},
	];

	const s = st.status;

	return (
		<div className="flex flex-col gap-4">
			{/* Đầu trang như trang chi tiết sự vụ: nút quay lại + tên + trạng thái, ghim khi cuộn. */}
			<div className={cn(STICKY_PAGE_BAR, "flex flex-wrap items-start justify-between gap-3")}>
				<div className="flex min-w-0 items-start gap-3">
					<Button variant="outline" size="icon" onClick={() => navigate("/ai/stations")} title={t("common.back")}>
						<Icon icon="solar:arrow-left-linear" size={18} />
					</Button>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="text-xl font-bold">{st.name}</h1>
							<StationStateBadge station={st} />
						</div>
						<p className="text-sm text-text-secondary">
							<span className="font-mono">{st.id}</span>
							{st.location && ` · ${st.location}`}
						</p>
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" onClick={() => navigate(`/ai/events?station=${st.id}`)}>
						<Icon icon="solar:bell-bing-linear" size={18} />
						{t("aiStation.viewEvents")}
					</Button>
					{canManage && (
						<>
							<Button variant="outline" onClick={() => setEditing(true)}>
								<Icon icon="solar:pen-linear" size={18} />
								{t("aiStation.rename")}
							</Button>
							<Button onClick={confirmRotate} disabled={rotate.isPending}>
								<Icon icon="solar:key-minimalistic-square-linear" size={18} />
								{t("aiStation.rotate")}
							</Button>
							<Button variant="ghost" className="text-error" onClick={confirmDelete} disabled={remove.isPending}>
								<Icon icon="solar:trash-bin-trash-linear" size={18} />
								{t("common.delText")}
							</Button>
						</>
					)}
				</div>
			</div>
			<MockNotice className="mb-0" />

			{state === "unpaired" && (
				<Alert
					type="info"
					showIcon
					message={t("aiStation.notPairedTitle")}
					description={t("aiStation.notPairedHint")}
				/>
			)}
			{state === "offline" && <Alert type="error" showIcon message={t("aiStation.offlineHint")} />}

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
				<Card className="xl:col-span-2">
					<CardHeader>
						<CardTitle>{t("aiStation.info")}</CardTitle>
					</CardHeader>
					<CardContent>
						<Descriptions column={{ xs: 1, md: 2 }} size="small" bordered>
							<Descriptions.Item label={t("common.statusLabel")}>
								<StationOnline station={st} />
							</Descriptions.Item>
							<Descriptions.Item label={t("aiStation.field.id")}>
								<Typography.Text copyable className="font-mono">
									{st.id}
								</Typography.Text>
							</Descriptions.Item>
							<Descriptions.Item label={t("aiStation.field.version")}>
								{st.version ? <span className="font-mono">v{st.version}</span> : "—"}
							</Descriptions.Item>
							<Descriptions.Item label={t("aiStation.field.hostname")}>
								<span className="font-mono">{s?.hostname || "—"}</span>
							</Descriptions.Item>
							<Descriptions.Item label={t("aiStation.field.hardware")}>
								<AccelLabel accel={st.accel} gpu={st.gpu} />
							</Descriptions.Item>
							<Descriptions.Item label={t("aiStation.field.cameras")}>
								{t("aiStation.camerasLive", { live: st.cameras_live, total: st.cameras_total })}
							</Descriptions.Item>
							<Descriptions.Item label={t("aiStation.field.tenant")}>{st.tenant_name || "—"}</Descriptions.Item>
							<Descriptions.Item label={t("aiStation.field.eventsToday")}>
								<b>{st.events_today}</b>
							</Descriptions.Item>
							<Descriptions.Item label={t("aiStation.field.location")} span={{ xs: 1, md: 2 }}>
								{st.location || "—"}
							</Descriptions.Item>
							<Descriptions.Item label={t("common.createdAt")}>{fmtDateTime(st.created_at)}</Descriptions.Item>
							<Descriptions.Item label={t("aiStation.field.configRevision")}>
								{s ? s.config_revision : "—"}
							</Descriptions.Item>
						</Descriptions>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{t("aiStation.resources")}</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<UsageBar label="CPU" value={s?.cpu_pct} />
						<UsageBar label="RAM" value={s?.ram_pct} />
						<UsageBar label="GPU" value={s?.gpu_pct} />
						<div>
							<p className="mb-1.5 text-xs text-text-secondary">{t("aiStation.field.alarms")}</p>
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
								<p className="text-sm text-text-disabled">{t("aiStation.noAlarm")}</p>
							)}
						</div>
						{s && (
							<p className="text-xs text-text-disabled">
								{t("aiStation.statusAt", { time: fmtDateTime(s.ts / 1000, "DD/MM/YYYY HH:mm:ss") })}
							</p>
						)}
					</CardContent>
				</Card>
			</div>

			<Card className="gap-0 py-3">
				<CardContent className="px-4 sm:px-6">
					<Tabs
						activeKey={tab}
						onChange={setTab}
						items={[
							{
								key: "cameras",
								label: (
									<span className="inline-flex items-center gap-1.5">
										<Icon icon="solar:videocamera-record-linear" size={16} />
										{t("aiStation.tab.cameras", { n: st.cameras.length })}
									</span>
								),
								children: (
									<Table<StationCamera>
										rowKey="id"
										size="middle"
										scroll={{ x: "max-content" }}
										pagination={false}
										columns={cameraColumns}
										dataSource={st.cameras}
										locale={{ emptyText: <EmptyState text={t("aiStation.noCameras")} /> }}
									/>
								),
							},
							{
								key: "plugins",
								label: (
									<span className="inline-flex items-center gap-1.5">
										<Icon icon="solar:widget-add-linear" size={16} />
										{t("aiStation.tab.plugins", { n: st.plugins.length })}
									</span>
								),
								children: (
									<Table<PluginInfo>
										rowKey="name"
										size="middle"
										scroll={{ x: "max-content" }}
										pagination={false}
										columns={pluginColumns}
										dataSource={st.plugins}
										locale={{ emptyText: <EmptyState text={t("aiStation.noPlugins")} /> }}
									/>
								),
							},
							{
								key: "events",
								label: (
									<span className="inline-flex items-center gap-1.5">
										<Icon icon="solar:bell-bing-linear" size={16} />
										{t("aiStation.tab.events")}
									</span>
								),
								// Chỉ dựng khi mở tab để khỏi tải sự kiện thừa.
								children: tab === "events" && <EventTable filters={{ station_id: st.id }} hideStation />,
							},
						]}
					/>
				</CardContent>
			</Card>

			<StationFormModal station={editing ? st : undefined} onClose={() => setEditing(false)} />
			<PairingTokenModal result={token} onClose={() => setToken(null)} />
		</div>
	);
}
