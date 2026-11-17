import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Descriptions, Dropdown, Skeleton, Table, Tabs, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import type { AiStationWithToken, PluginInfo } from "#/vigil";
import aiStationService from "@/api/services/aiStationService";
import EmptyState from "@/components/cmc/empty-state";
import { STICKY_PAGE_BAR } from "@/components/cmc/page-header";
import { Icon } from "@/components/icon";
import { AI_STATION_MANAGE } from "@/constants/permission";
import { useCan } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { cn } from "@/utils";
import { fmtDateTime } from "@/utils/format";
import { eventTypeLabel } from "../ai-event/components/event-meta";
import EventTable from "../ai-event/components/event-table";
import PulseStrip from "./components/pulse-strip";
import StationCameras from "./components/station-cameras";
import { CommandHistory } from "./components/station-commands";
import { PairingTokenModal, StationFormModal } from "./components/station-modals";
import StationOverview, { type CameraFilter } from "./components/station-overview";
import { AccelLabel, MockNotice, StationOnline, StationStateBadge, stationState } from "./components/station-status";

const TABS = ["overview", "cameras", "plugins", "commands", "events", "system"] as const;
type TabKey = (typeof TABS)[number];

/**
 * Chi tiết một trạm AI — bố cục theo trang AI agent của Sentinel: khối đầu trang (tên, trạng
 * thái, thao tác) + dải nhịp tim, rồi các tab Tổng quan / Camera / Plugin / Lệnh / Sự kiện /
 * Hệ thống. Tab đang mở nằm trên URL (`?tab=`) để tải lại / chia sẻ link vẫn đúng tab.
 */
export default function AiStationDetailPage() {
	const { t } = useTranslation();
	const { modal } = App.useApp();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const can = useCan();
	const canManage = can(AI_STATION_MANAGE);
	const id = useParams().id as string;
	const [params, setParams] = useSearchParams();
	const tab: TabKey = TABS.includes(params.get("tab") as TabKey) ? (params.get("tab") as TabKey) : "overview";
	const setTab = (k: string) =>
		setParams(
			(p) => {
				p.set("tab", k);
				return p;
			},
			{ replace: true },
		);

	const [editing, setEditing] = useState(false);
	const [token, setToken] = useState<AiStationWithToken | null>(null);
	const [camFilter, setCamFilter] = useState<CameraFilter>("all");
	const [camSearch, setCamSearch] = useState("");

	const { data: st, isLoading } = useQuery({
		queryKey: ["ai-station", "detail", id],
		queryFn: () => aiStationService.getStation(id),
		// Trạm báo trạng thái ~30 s/lần; làm mới 10 s để dải nhịp tim bắt kịp.
		refetchInterval: 10_000,
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

	const inspectCameras = (f: CameraFilter) => {
		setCamFilter(f);
		setTab("cameras");
	};

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
	const pluginsOn = st.plugins.filter((p) => p.enabled).length;
	const tabLabel = (icon: string, text: string, count?: number) => (
		<span className="inline-flex items-center gap-1.5">
			<Icon icon={icon} size={16} />
			{text}
			{count != null && <span className="font-mono text-[11px] tabular-nums text-text-secondary">{count}</span>}
		</span>
	);

	return (
		<div className="flex flex-col gap-4">
			{/* Đầu trang ghim khi cuộn: tên, trạng thái, mã trạm, thao tác + dải nhịp tim. */}
			<div className={cn(STICKY_PAGE_BAR, "pb-0")}>
				<div className="rounded-lg border border-border/60 bg-background">
					<div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5">
						<div className="flex min-w-0 items-start gap-3">
							<Button variant="outline" size="icon" onClick={() => navigate("/ai/stations")} title={t("common.back")}>
								<Icon icon="solar:arrow-left-linear" size={18} />
							</Button>
							<span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
								<Icon icon="solar:server-square-cloud-bold-duotone" size={24} />
							</span>
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<h1 className="text-xl font-bold">{st.name}</h1>
									<StationStateBadge station={st} />
								</div>
								<p className="flex flex-wrap items-center gap-x-2 text-sm text-text-secondary">
									<Typography.Text copyable={{ text: st.id }} className="font-mono text-sm text-text-secondary">
										{st.id}
									</Typography.Text>
									{st.version && <span className="font-mono">· v{st.version}</span>}
									{st.tenant_name && <span>· {st.tenant_name}</span>}
									{st.location && <span>· {st.location}</span>}
								</p>
							</div>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button variant="outline" onClick={() => setTab("events")}>
								<Icon icon="solar:bell-bing-linear" size={18} />
								{t("aiStation.viewEvents")}
							</Button>
							{canManage && (
								<>
									<Button variant="outline" onClick={() => setEditing(true)}>
										<Icon icon="solar:pen-linear" size={18} />
										{t("aiStation.rename")}
									</Button>
									<Dropdown
										trigger={["click"]}
										menu={{
											items: [
												{
													key: "rotate",
													icon: <Icon icon="solar:key-minimalistic-square-linear" size={16} />,
													label: t("aiStation.rotate"),
													disabled: rotate.isPending,
													onClick: confirmRotate,
												},
												{ type: "divider" },
												{
													key: "delete",
													danger: true,
													icon: <Icon icon="solar:trash-bin-trash-linear" size={16} />,
													label: t("common.delText"),
													disabled: remove.isPending,
													onClick: confirmDelete,
												},
											],
										}}
									>
										<Button variant="outline" size="icon" aria-label={t("aiStation.more")}>
											<Icon icon="solar:menu-dots-bold" size={18} />
										</Button>
									</Dropdown>
								</>
							)}
						</div>
					</div>
					<PulseStrip lastSeen={st.last_seen} online={st.online} />
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

			<Tabs
				activeKey={tab}
				onChange={setTab}
				items={[
					{
						key: "overview",
						label: tabLabel("solar:widget-5-linear", t("aiStation.tab.overview")),
						children: (
							<StationOverview
								station={st}
								onInspectCameras={inspectCameras}
								onInspectPlugins={() => setTab("plugins")}
							/>
						),
					},
					{
						key: "cameras",
						label: tabLabel("solar:videocamera-record-linear", t("aiStation.tab.camerasPlain"), st.cameras.length),
						children: (
							<Card className="py-4">
								<CardContent className="px-4 sm:px-6">
									<StationCameras
										station={st}
										filter={camFilter}
										onFilterChange={setCamFilter}
										search={camSearch}
										onSearchChange={setCamSearch}
										canManage={canManage}
									/>
								</CardContent>
							</Card>
						),
					},
					{
						key: "plugins",
						label: tabLabel("solar:widget-add-linear", t("aiStation.tab.pluginsPlain"), pluginsOn),
						children: (
							<Card className="py-3">
								<CardContent className="px-4 sm:px-6">
									<Table<PluginInfo>
										rowKey="name"
										size="middle"
										scroll={{ x: "max-content" }}
										pagination={false}
										columns={pluginColumns}
										dataSource={st.plugins}
										locale={{ emptyText: <EmptyState text={t("aiStation.noPlugins")} /> }}
									/>
								</CardContent>
							</Card>
						),
					},
					{
						key: "commands",
						label: tabLabel("solar:command-linear", t("aiStation.tab.commands")),
						children: tab === "commands" && (
							<Card className="py-3">
								<CardContent className="px-4 sm:px-6">
									<CommandHistory stationId={st.id} />
								</CardContent>
							</Card>
						),
					},
					{
						key: "events",
						label: tabLabel("solar:bell-bing-linear", t("aiStation.tab.events")),
						// Chỉ dựng khi mở tab để khỏi tải sự kiện thừa.
						children: tab === "events" && (
							<Card className="py-3">
								<CardContent className="px-4 sm:px-6">
									<EventTable filters={{ station_id: st.id }} hideStation />
								</CardContent>
							</Card>
						),
					},
					{
						key: "system",
						label: tabLabel("solar:settings-linear", t("aiStation.tab.system")),
						children: (
							<Card className="py-4">
								<CardContent className="px-4 sm:px-6">
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
										<Descriptions.Item label={t("aiStation.field.pairedAt")}>
											{st.paired_at ? fmtDateTime(st.paired_at) : t("aiStation.notPaired")}
										</Descriptions.Item>
										<Descriptions.Item label={t("aiStation.field.configRevision")}>
											{s ? s.config_revision : "—"}
										</Descriptions.Item>
									</Descriptions>
								</CardContent>
							</Card>
						),
					},
				]}
			/>

			<StationFormModal station={editing ? st : undefined} onClose={() => setEditing(false)} />
			<PairingTokenModal result={token} onClose={() => setToken(null)} />
		</div>
	);
}
