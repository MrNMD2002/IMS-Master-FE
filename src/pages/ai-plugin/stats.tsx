import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Table } from "antd";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { ThemeMode } from "#/enum";
import type { AiEventQuery, AiEventStats } from "#/vigil";
import aiStationService from "@/api/services/aiStationService";
import { Chart, useChart } from "@/components/chart";
import StatCard from "@/components/cmc/stat-card";
import { useSettings } from "@/store/settingStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { eventMeta, eventTypeLabel } from "../ai-event/components/event-meta";
import PluginShell from "./plugin-shell";
import type { PluginPage } from "./plugins";

/** Thống kê của một plugin (`/ai/p/:slug/stats`) — bố cục trang thống kê chức năng của hệ tham khảo. */
export default function PluginStatsPage() {
	return <PluginShell view="stats">{(p) => <StatsBody {...p} />}</PluginShell>;
}

function StatsBody({ plugin, filters }: { plugin: PluginPage; filters: Omit<AiEventQuery, "page" | "page_size"> }) {
	const { t } = useTranslation();
	const { themeMode } = useSettings();
	const dark = themeMode === ThemeMode.Dark;
	const { data, isFetching } = useQuery({
		queryKey: ["ai-event", "stats", filters],
		queryFn: () => aiStationService.eventStats(filters),
		placeholderData: keepPreviousData,
		refetchInterval: 60_000,
	});
	const s: AiEventStats | undefined = data;
	const loading = !s;

	const days = s?.by_day ?? [];
	const nDays = Math.max(1, dayjs(filters.to).diff(dayjs(filters.from), "day") + 1);
	const hours = s?.by_hour?.length === 24 ? s.by_hour : Array(24).fill(0);
	const peakHour = hours.some((h) => h > 0) ? hours.indexOf(Math.max(...hours)) : null;
	const types = plugin.types.filter((x) => (s?.by_type ?? []).some((b) => b.event_type === x && b.total > 0));
	const shownTypes = types.length ? types : plugin.types.slice(0, 1);
	const accent = eventMeta(plugin.types[0]).color;
	const cameras = s?.by_camera ?? [];
	const multiStation = new Set(cameras.map((c) => c.station_id)).size > 1;
	const camLabel = (c: (typeof cameras)[number]) =>
		`${c.camera_name ?? `#${c.camera_id}`}${multiStation && c.station_name ? ` · ${c.station_name}` : ""}`;
	const ink = dark ? "#E5E7EB" : "#1C252E";

	const dayChart = useChart({
		chart: { stacked: true, toolbar: { show: false }, zoom: { enabled: false } },
		colors: shownTypes.map((x) => eventMeta(x).color),
		plotOptions: {
			bar: { columnWidth: days.length > 20 ? "70%" : "45%", borderRadius: 3, borderRadiusApplication: "end" },
		},
		dataLabels: { enabled: false },
		xaxis: {
			categories: days.map((d) => dayjs(d.day).format("DD/MM")),
			labels: { rotate: -45, hideOverlappingLabels: true },
			axisTicks: { show: false },
		},
		yaxis: { min: 0, forceNiceScale: true, labels: { formatter: (v: number) => `${Math.round(v)}` } },
		legend: { show: shownTypes.length > 1, position: "top", horizontalAlign: "left" },
		tooltip: { shared: true, intersect: false },
		grid: { strokeDashArray: 3 },
	});

	const cameraChart = useChart({
		chart: { toolbar: { show: false } },
		colors: [accent],
		plotOptions: {
			bar: {
				horizontal: true,
				barHeight: "60%",
				borderRadius: 4,
				borderRadiusApplication: "end",
				dataLabels: { position: "top" },
			},
		},
		dataLabels: { enabled: true, offsetX: 22, style: { colors: [ink], fontWeight: 600 } },
		xaxis: {
			categories: cameras.map(camLabel),
			min: 0,
			max: Math.max(5, Math.ceil(Math.max(0, ...cameras.map((c) => c.total)) * 1.2)),
			tickAmount: 5,
			labels: { formatter: (v: string) => `${Math.round(Number(v))}` },
		},
		yaxis: { labels: { maxWidth: 200 } },
		legend: { show: false },
		tooltip: { y: { formatter: (v: number) => t("aiEvent.stats.count", { count: v }) } },
		grid: { strokeDashArray: 3, padding: { right: 24 } },
	});

	const hourChart = useChart({
		chart: { toolbar: { show: false } },
		colors: [accent],
		plotOptions: { bar: { columnWidth: "65%", borderRadius: 3, borderRadiusApplication: "end" } },
		dataLabels: { enabled: false },
		xaxis: { categories: hours.map((_, h) => `${h}h`), labels: { hideOverlappingLabels: true } },
		yaxis: { min: 0, forceNiceScale: true, labels: { formatter: (v: number) => `${Math.round(v)}` } },
		tooltip: {
			x: {
				formatter: (_v: number, o?: { dataPointIndex: number }) =>
					o ? `${o.dataPointIndex}:00–${o.dataPointIndex}:59` : "",
			},
			y: { formatter: (v: number) => t("aiEvent.stats.count", { count: v }) },
		},
		grid: { strokeDashArray: 3 },
	});

	const kpis = [
		{
			title: t("aiEvent.stats.total"),
			value: s?.total,
			hint: t("aiPlugin.kpi.perDay", { n: s ? Math.round((s.total / nDays) * 10) / 10 : "—" }),
			icon: plugin.icon,
			tone: "primary" as const,
		},
		...plugin.kpis(s, t),
		{
			title: t("aiPlugin.kpi.peakHour"),
			value: s ? (peakHour != null ? `${peakHour}:00` : "—") : undefined,
			hint: peakHour != null ? t("aiEvent.stats.count", { count: hours[peakHour] }) : undefined,
			icon: "solar:clock-circle-bold-duotone",
			tone: "info" as const,
		},
	].slice(0, 4);

	const fade = isFetching ? "opacity-60 transition-opacity" : "";

	return (
		<>
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				{kpis.map((k) => (
					<StatCard
						key={k.title}
						title={k.title}
						value={k.value}
						hint={k.hint}
						icon={k.icon}
						tone={k.tone}
						loading={loading}
					/>
				))}
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t("aiPlugin.chart.byDay")}</CardTitle>
				</CardHeader>
				<CardContent className={fade}>
					<Chart
						type="bar"
						height={280}
						options={dayChart}
						series={shownTypes.map((x) => ({
							name: eventTypeLabel(t, x),
							data: days.map((d) => d.by_type[x] ?? 0),
						}))}
					/>
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>{t("aiPlugin.chart.byCamera")}</CardTitle>
					</CardHeader>
					<CardContent className={fade}>
						{cameras.length ? (
							<Chart
								type="bar"
								options={cameraChart}
								series={[{ name: t("aiEvent.stats.total"), data: cameras.map((c) => c.total) }]}
								height={Math.max(200, cameras.length * 36 + 40)}
							/>
						) : (
							<p className="py-10 text-center text-sm text-text-secondary">{t("aiEvent.empty")}</p>
						)}
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{t("aiPlugin.chart.byHour")}</CardTitle>
					</CardHeader>
					<CardContent className={fade}>
						<Chart
							type="bar"
							options={hourChart}
							series={[{ name: t("aiEvent.stats.total"), data: hours }]}
							height={260}
						/>
					</CardContent>
				</Card>
			</div>

			<Card className="gap-3">
				<CardHeader>
					<CardTitle>{t("aiPlugin.chart.dailyTable")}</CardTitle>
				</CardHeader>
				<CardContent>
					<Table
						rowKey="day"
						size="small"
						pagination={{ pageSize: 10, hideOnSinglePage: true }}
						dataSource={[...days].reverse()}
						columns={[
							{
								title: t("aiPlugin.col.day"),
								dataIndex: "day",
								render: (d: string) => dayjs(d).format("dddd, DD/MM/YYYY"),
							},
							...(shownTypes.length > 1
								? shownTypes.map((x) => ({
										title: eventTypeLabel(t, x),
										key: x,
										align: "right" as const,
										render: (_: unknown, d: (typeof days)[number]) => d.by_type[x] ?? 0,
									}))
								: []),
							{
								title: t("aiEvent.stats.total"),
								dataIndex: "total",
								align: "right",
								render: (n: number) => <b className="tabular-nums">{n}</b>,
							},
						]}
					/>
				</CardContent>
			</Card>
		</>
	);
}
