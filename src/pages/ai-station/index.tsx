import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Input, Segmented, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { type ReactNode, useState } from "react";
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
import { fmtFromNow } from "@/utils/format";
import { PairingTokenModal, StationFormModal } from "./components/station-modals";
import {
	AccelLabel,
	AlarmCell,
	CameraCount,
	MockNotice,
	StationOnline,
	StationStateBadge,
	stationState,
} from "./components/station-status";

type View = "table" | "grid";
const VIEW_KEY = "cmc.aiStation.view";

function readView(): View {
	try {
		// Mặc định dạng thẻ như danh sách AI agent của hệ tham khảo; nhớ lựa chọn của người xem.
		return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "grid";
	} catch {
		return "grid";
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

/** Một dòng "nhãn — giá trị" trong thẻ trạm (bố cục thẻ AI agent của hệ tham khảo). */
function InfoRow({
	icon,
	label,
	children,
	last,
}: {
	icon: string;
	label: string;
	children: ReactNode;
	last?: boolean;
}) {
	return (
		<div className={cn("flex items-center justify-between gap-3 py-2", !last && "border-b border-border/50")}>
			<span className="inline-flex items-center gap-2 text-sm text-text-secondary">
				<Icon icon={icon} size={16} className="text-primary" />
				{label}
			</span>
			<span className="min-w-0 truncate text-right text-sm font-medium">{children}</span>
		</div>
	);
}

function StationCard({ station: s, onClick }: { station: AiStation; onClick: () => void }) {
	const { t } = useTranslation();
	const state = stationState(s);
	const load = s.cameras_total ? (s.cameras_live / s.cameras_total) * 100 : 0;
	return (
		<Card
			onClick={onClick}
			className={cn(
				"group cursor-pointer gap-3 px-5 py-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
				state === "offline" && "border-error/40",
			)}
		>
			<div className="flex items-start gap-3">
				<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<Icon icon="solar:server-square-cloud-bold-duotone" size={24} />
				</span>
				<div className="min-w-0 flex-1">
					<p className="truncate font-semibold group-hover:text-primary">{s.name}</p>
					<p className="truncate text-xs text-text-secondary">
						<span className="font-mono">{s.id}</span>
						{s.location && ` · ${s.location}`}
					</p>
				</div>
				{s.alarms.length > 0 && <AlarmCell alarms={s.alarms} />}
			</div>
			<div>
				<InfoRow icon="solar:widget-5-linear" label={t("common.statusLabel")}>
					<StationStateBadge station={s} />
				</InfoRow>
				<InfoRow icon="solar:tag-linear" label={t("aiStation.field.version")}>
					<span className="font-mono text-xs">{s.version ? `v${s.version}` : "—"}</span>
				</InfoRow>
				<InfoRow icon="solar:cpu-linear" label={t("aiStation.field.hardware")}>
					<AccelLabel accel={s.accel} gpu={s.gpu} />
				</InfoRow>
				<InfoRow icon="solar:videocamera-record-linear" label={t("aiStation.field.cameras")}>
					<span className="inline-flex items-center gap-2">
						<span className="h-2 w-16 overflow-hidden rounded-full bg-muted">
							<span className="block h-full bg-primary" style={{ width: `${load}%` }} />
						</span>
						{s.cameras_live}/{s.cameras_total}
					</span>
				</InfoRow>
				<InfoRow icon="solar:bell-bing-linear" label={t("aiStation.field.eventsToday")}>
					{s.events_today}
				</InfoRow>
				<InfoRow icon="solar:refresh-linear" label={t("aiStation.card.lastSeen")} last>
					{s.last_seen ? fmtFromNow(s.last_seen) : t("aiStation.notPaired")}
				</InfoRow>
			</div>
			<div className="flex items-center justify-between border-t border-border/50 pt-3 text-xs text-text-secondary">
				<span className="truncate">{s.tenant_name ?? ""}</span>
				<span className="inline-flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
					{t("aiStation.card.open")}
					<Icon icon="solar:arrow-right-linear" size={14} />
				</span>
			</div>
		</Card>
	);
}
