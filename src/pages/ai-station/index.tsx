import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Input, Segmented, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { AiStation, AiStationWithToken } from "#/vigil";
import aiStationService from "@/api/services/aiStationService";
import EmptyState from "@/components/cmc/empty-state";
import PageHeader from "@/components/cmc/page-header";
import StatCard from "@/components/cmc/stat-card";
import { Icon } from "@/components/icon";
import { AI_STATION_MANAGE } from "@/constants/permission";
import { useCan } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { cn } from "@/utils";
import { PairingTokenModal, StationFormModal } from "./components/station-modals";
import {
	AccelLabel,
	AlarmCell,
	CameraCount,
	MockNotice,
	StationOnline,
	StatusDot,
	stationState,
} from "./components/station-status";

type View = "table" | "grid";
const VIEW_KEY = "cmc.aiStation.view";

function readView(): View {
	try {
		return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "table";
	} catch {
		return "table";
	}
}

/** Danh sách trạm AI Vigil: trạng thái, phần cứng, camera, cảnh báo, sự kiện hôm nay. */
export default function AiStationListPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const can = useCan();
	const canManage = can(AI_STATION_MANAGE);

	const [search, setSearch] = useState("");
	const [keyword, setKeyword] = useState("");
	const [view, setViewState] = useState<View>(readView);
	const [creating, setCreating] = useState<null | undefined>(undefined);
	const [token, setToken] = useState<AiStationWithToken | null>(null);

	const setView = (v: View) => {
		setViewState(v);
		try {
			localStorage.setItem(VIEW_KEY, v);
		} catch {
			/* trình duyệt chặn lưu trữ: bỏ qua */
		}
	};

	const { data, isFetching, refetch } = useQuery({
		queryKey: ["ai-station", "list", keyword],
		queryFn: () => aiStationService.listStations({ page: 1, page_size: 200, search: keyword || undefined }),
		placeholderData: keepPreviousData,
		refetchInterval: 30_000,
	});
	const stations = data?.data ?? [];
	const online = stations.filter((s) => s.online).length;
	const camLive = stations.reduce((n, s) => n + s.cameras_live, 0);
	const camTotal = stations.reduce((n, s) => n + s.cameras_total, 0);
	const eventsToday = stations.reduce((n, s) => n + s.events_today, 0);
	const withAlarm = stations.filter((s) => s.alarms.length > 0).length;

	const open = (s: AiStation) => navigate(`/ai/stations/${s.id}`);

	const columns: ColumnsType<AiStation> = [
		{
			title: t("aiStation.field.name"),
			dataIndex: "name",
			render: (_, s) => (
				<div className="flex min-w-[220px] items-center gap-3">
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
						<Icon icon="solar:server-square-cloud-bold-duotone" size={20} />
					</span>
					<div className="min-w-0">
						<p className="truncate font-medium">{s.name}</p>
						<p className="truncate text-xs text-text-secondary max-w-[300px]">
							<span className="font-mono">{s.id}</span>
							{s.location && ` · ${s.location}`}
						</p>
					</div>
				</div>
			),
		},
		{ title: t("common.statusLabel"), key: "online", render: (_, s) => <StationOnline station={s} /> },
		{
			title: t("aiStation.field.version"),
			dataIndex: "version",
			render: (v) => (v ? <span className="font-mono text-sm">v{v}</span> : "—"),
		},
		{
			title: t("aiStation.field.hardware"),
			key: "accel",
			render: (_, s) => <AccelLabel accel={s.accel} gpu={s.gpu} />,
		},
		{
			title: t("aiStation.field.cameras"),
			key: "cameras",
			render: (_, s) => <CameraCount live={s.cameras_live} total={s.cameras_total} />,
		},
		{ title: t("aiStation.field.alarms"), dataIndex: "alarms", render: (a: string[]) => <AlarmCell alarms={a} /> },
		{
			title: t("aiStation.field.eventsToday"),
			dataIndex: "events_today",
			align: "right",
			render: (n: number) => <b className={cn(n === 0 && "font-normal text-text-disabled")}>{n}</b>,
		},
		{
			key: "go",
			width: 48,
			render: () => <Icon icon="solar:alt-arrow-right-linear" size={18} className="text-text-disabled" />,
		},
	];

	return (
		<>
			<PageHeader
				icon="solar:server-square-cloud-bold-duotone"
				title={t("sys.nav.aiStationList")}
				description={t("aiStation.description")}
				actions={
					<>
						<Button variant="outline" onClick={() => refetch()}>
							<Icon icon="solar:refresh-linear" size={18} />
							{t("common.refresh")}
						</Button>
						{canManage && (
							<Button onClick={() => setCreating(null)}>
								<Icon icon="solar:add-circle-bold" size={18} />
								{t("aiStation.create")}
							</Button>
						)}
					</>
				}
				toolbar={
					<>
						<Input.Search
							allowClear
							className="max-w-xs"
							placeholder={t("aiStation.searchPlaceholder")}
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								if (!e.target.value) setKeyword("");
							}}
							onSearch={(v) => setKeyword(v.trim())}
						/>
						<Segmented
							className="ml-auto"
							value={view}
							onChange={(v) => setView(v as View)}
							options={[
								{ value: "table", label: t("aiStation.view.table"), icon: <Icon icon="solar:list-bold" size={16} /> },
								{
									value: "grid",
									label: t("aiStation.view.grid"),
									icon: <Icon icon="solar:widget-4-bold" size={16} />,
								},
							]}
						/>
					</>
				}
			/>
			<MockNotice />

			<div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
				<StatCard
					title={t("aiStation.summary.online")}
					value={data ? `${online}/${stations.length}` : undefined}
					icon="solar:server-square-cloud-bold-duotone"
					tone="success"
					hint={withAlarm ? t("aiStation.summary.withAlarm", { n: withAlarm }) : undefined}
					loading={!data}
				/>
				<StatCard
					title={t("aiStation.summary.cameras")}
					value={data ? `${camLive}/${camTotal}` : undefined}
					icon="solar:videocamera-record-bold-duotone"
					tone="info"
					loading={!data}
				/>
				<StatCard
					title={t("aiStation.summary.eventsToday")}
					value={data ? eventsToday : undefined}
					icon="solar:bell-bing-bold-duotone"
					tone="warning"
					onClick={() => navigate("/ai/events")}
					loading={!data}
				/>
				<StatCard
					title={t("aiStation.summary.offline")}
					value={data ? stations.filter((s) => stationState(s) === "offline").length : undefined}
					icon="solar:plug-circle-bold-duotone"
					tone="error"
					loading={!data}
				/>
			</div>

			{view === "table" ? (
				<Card className="gap-0 py-5">
					<CardContent className="px-4 sm:px-6">
						<Table
							rowKey="id"
							size="middle"
							scroll={{ x: "max-content" }}
							loading={isFetching && !data}
							columns={columns}
							dataSource={stations}
							onRow={(s) => ({ onClick: () => open(s), className: "cursor-pointer" })}
							locale={{ emptyText: <EmptyState text={t("aiStation.empty")} /> }}
							pagination={
								stations.length > 20 ? { pageSize: 20, showTotal: (n) => t("common.totalItems", { total: n }) } : false
							}
						/>
					</CardContent>
				</Card>
			) : stations.length === 0 ? (
				<Card>
					<EmptyState text={t("aiStation.empty")} />
				</Card>
			) : (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
					{stations.map((s) => (
						<StationCard key={s.id} station={s} onClick={() => open(s)} />
					))}
				</div>
			)}

			<StationFormModal station={creating} onClose={() => setCreating(undefined)} onCreated={setToken} />
			<PairingTokenModal result={token} onClose={() => setToken(null)} />
		</>
	);
}

function StationCard({ station: s, onClick }: { station: AiStation; onClick: () => void }) {
	const { t } = useTranslation();
	const state = stationState(s);
	return (
		<Card
			onClick={onClick}
			className={cn(
				"cursor-pointer gap-4 px-5 py-5 transition-shadow hover:shadow-md",
				state === "offline" && "border-error/40",
			)}
		>
			<div className="flex items-start gap-3">
				<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<Icon icon="solar:server-square-cloud-bold-duotone" size={24} />
				</span>
				<div className="min-w-0 flex-1">
					<p className="flex items-center gap-2 font-semibold">
						<StatusDot state={state} />
						<span className="truncate">{s.name}</span>
					</p>
					<p className="truncate text-xs text-text-secondary">
						<span className="font-mono">{s.id}</span>
						{s.location && ` · ${s.location}`}
					</p>
				</div>
				{s.version && <span className="shrink-0 font-mono text-xs text-text-secondary">v{s.version}</span>}
			</div>
			<StationOnline station={s} />
			<div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-center">
				<div>
					<p className="text-xs text-text-secondary">{t("aiStation.field.cameras")}</p>
					<p className="font-semibold">
						{s.cameras_live}
						<span className="font-normal text-text-secondary">/{s.cameras_total}</span>
					</p>
				</div>
				<div>
					<p className="text-xs text-text-secondary">{t("aiStation.field.eventsToday")}</p>
					<p className="font-semibold">{s.events_today}</p>
				</div>
				<div>
					<p className="text-xs text-text-secondary">{t("aiStation.field.alarms")}</p>
					<p className={cn("font-semibold", s.alarms.length > 0 && "text-warning-dark dark:text-warning")}>
						{s.alarms.length}
					</p>
				</div>
			</div>
			<div className="flex items-center justify-between gap-2">
				<AccelLabel accel={s.accel} gpu={s.gpu} />
				{s.alarms.length > 0 && <AlarmCell alarms={s.alarms} />}
			</div>
		</Card>
	);
}
