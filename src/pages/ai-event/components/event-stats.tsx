import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { ThemeMode } from "#/enum";
import type { AiEventStats } from "#/vigil";
import { AI_EVENT_TYPES } from "#/vigil";
import { Chart, useChart } from "@/components/chart";
import StatCard from "@/components/cmc/stat-card";
import { useSettings } from "@/store/settingStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { eventMeta } from "./event-meta";

/** Thẻ số liệu + biểu đồ theo ngày / loại / trạm cho trang Sự kiện AI. */
export default function EventStats({
	data,
	loading,
	fetching,
	showStations,
}: {
	data?: AiEventStats;
	loading?: boolean;
	fetching?: boolean;
	showStations?: boolean;
}) {
	const { t } = useTranslation();
	const { themeMode } = useSettings();
	const dark = themeMode === ThemeMode.Dark;

	const typeCount = (k: string) => data?.by_type.find((x) => x.event_type === k)?.total ?? 0;
	const days = data?.by_day ?? [];
	const today = dayjs().format("YYYY-MM-DD");
	const todayCount = days.find((d) => d.day === today)?.total;
	// Loại có trong dữ liệu (giữ thứ tự chuẩn, loại lạ xếp cuối).
	const types = [
		...AI_EVENT_TYPES,
		...(data?.by_type ?? []).map((x) => x.event_type).filter((x) => !AI_EVENT_TYPES.includes(x as never)),
	];

	const dayChart = useChart({
		chart: { stacked: true, toolbar: { show: false }, zoom: { enabled: false } },
		colors: types.map((x) => eventMeta(x).color),
		plotOptions: {
			bar: { columnWidth: days.length > 20 ? "70%" : "50%", borderRadius: 3, borderRadiusApplication: "end" },
		},
		stroke: { show: true, width: 1, colors: ["var(--card, #fff)"] },
		dataLabels: { enabled: false },
		xaxis: {
			categories: days.map((d) => dayjs(d.day).format("DD/MM")),
			labels: { rotate: -45, hideOverlappingLabels: true },
			axisTicks: { show: false },
		},
		yaxis: { min: 0, forceNiceScale: true, labels: { formatter: (v: number) => `${Math.round(v)}` } },
		legend: { show: true, position: "top", horizontalAlign: "left", markers: { size: 6 } },
		tooltip: {
			shared: true,
			intersect: false,
			x: {
				formatter: (_v: number, o?: { dataPointIndex: number }) =>
					o ? dayjs(days[o.dataPointIndex]?.day).format("dddd, DD/MM/YYYY") : "",
			},
		},
		grid: { strokeDashArray: 3 },
	});
	const daySeries = types.map((x) => ({
		name: t(`aiEvent.type.${x}`, { defaultValue: x }),
		data: days.map((d) => d.by_type[x] ?? 0),
	}));

	const byType = (data?.by_type ?? []).filter((x) => x.total > 0);
	const typeChart = useChart({
		labels: byType.map((x) => t(`aiEvent.type.${x.event_type}`, { defaultValue: x.event_type })),
		colors: byType.map((x) => eventMeta(x.event_type).color),
		stroke: { colors: ["var(--card, #fff)"], width: 2 },
		legend: { show: true, position: "bottom", horizontalAlign: "center" },
		dataLabels: { enabled: true, formatter: (v: number) => `${Math.round(v)}%`, dropShadow: { enabled: false } },
		plotOptions: {
			pie: {
				donut: {
					size: "68%",
					labels: {
						show: true,
						total: { show: true, label: t("aiEvent.stats.total"), formatter: () => `${data?.total ?? 0}` },
					},
				},
			},
		},
		tooltip: { y: { formatter: (v: number) => t("aiEvent.stats.count", { count: v }) } },
	});

	const stations = data?.by_station ?? [];
	const stationChart = useChart({
		chart: { toolbar: { show: false } },
		colors: [dark ? "#00A5C4" : "#0090AE"],
		plotOptions: {
			bar: {
				horizontal: true,
				barHeight: "60%",
				borderRadius: 4,
				borderRadiusApplication: "end",
				dataLabels: { position: "top" },
			},
		},
		dataLabels: {
			enabled: true,
			offsetX: 22,
			style: { colors: [dark ? "#E5E7EB" : "#1C252E"], fontWeight: 600 },
		},
		xaxis: {
			categories: stations.map((x) => x.station_name),
			min: 0,
			max: Math.max(5, Math.ceil(Math.max(0, ...stations.map((x) => x.total)) * 1.2)),
			tickAmount: 5,
			labels: { formatter: (v: string) => `${Math.round(Number(v))}` },
		},
		yaxis: { labels: { maxWidth: 190 } },
		legend: { show: false },
		tooltip: { y: { formatter: (v: number) => t("aiEvent.stats.count", { count: v }) } },
		grid: { strokeDashArray: 3, padding: { right: 24 } },
	});

	const empty = <p className="py-10 text-center text-sm text-text-secondary">{t("aiEvent.empty")}</p>;

	return (
		<>
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<StatCard
					title={t("aiEvent.stats.total")}
					value={data?.total}
					icon="solar:bell-bing-bold-duotone"
					hint={t("aiEvent.stats.inRange")}
					loading={loading}
				/>
				<StatCard
					title={t("aiEvent.stats.fireSmoke")}
					value={data ? typeCount("fire") + typeCount("smoke") : undefined}
					hint={data && t("aiEvent.stats.fireSmokeHint", { fire: typeCount("fire"), smoke: typeCount("smoke") })}
					icon="solar:fire-bold-duotone"
					tone="error"
					loading={loading}
				/>
				<StatCard
					title={t("aiEvent.stats.today")}
					value={data ? (todayCount ?? "—") : undefined}
					icon="solar:calendar-mark-bold-duotone"
					tone="warning"
					loading={loading}
				/>
				<StatCard
					title={t("aiEvent.stats.avgScore")}
					value={data?.avg_score != null ? `${Math.round(data.avg_score * 100)}%` : data ? "—" : undefined}
					icon="solar:target-bold-duotone"
					tone="info"
					loading={loading}
				/>
			</div>

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
				<Card className="xl:col-span-2">
					<CardHeader>
						<CardTitle>{t("aiEvent.stats.byDay")}</CardTitle>
					</CardHeader>
					<CardContent className={fetching ? "opacity-60 transition-opacity" : ""}>
						<Chart type="bar" series={daySeries} options={dayChart} height={300} />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{t("aiEvent.stats.byType")}</CardTitle>
					</CardHeader>
					<CardContent>
						{byType.length ? (
							<Chart type="donut" series={byType.map((x) => x.total)} options={typeChart} height={300} />
						) : (
							empty
						)}
					</CardContent>
				</Card>
			</div>

			{showStations && stations.length > 1 && (
				<Card>
					<CardHeader>
						<CardTitle>{t("aiEvent.stats.byStation")}</CardTitle>
					</CardHeader>
					<CardContent>
						<Chart
							type="bar"
							series={[{ name: t("aiEvent.stats.total"), data: stations.map((x) => x.total) }]}
							options={stationChart}
							height={Math.max(160, stations.length * 40 + 40)}
						/>
					</CardContent>
				</Card>
			)}
		</>
	);
}
