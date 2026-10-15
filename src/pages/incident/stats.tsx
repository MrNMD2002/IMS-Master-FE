import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { DatePicker, Segmented, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { INCIDENT_STATUSES, type IncidentReportBucket, type IncidentStatus, type ReportPeriod } from "#/cmc";
import { ThemeMode } from "#/enum";
import incidentService from "@/api/services/incidentService";
import { Chart, useChart } from "@/components/chart";
import OrgUnitFilter from "@/components/cmc/org-unit-filter";
import StatCard from "@/components/cmc/stat-card";
import { Icon } from "@/components/icon";
import { useSettings } from "@/store/settingStore";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { downloadBlob } from "@/utils/format";

const { RangePicker } = DatePicker;
const PERIODS: ReportPeriod[] = ["day", "week", "month", "year"];

/** Khoảng mặc định khi đổi kiểu gộp — đủ mốc để thấy xu hướng mà không quá dày. */
const DEFAULT_RANGE: Record<ReportPeriod, () => [Dayjs, Dayjs]> = {
	day: () => [dayjs().subtract(29, "day"), dayjs()],
	week: () => [dayjs().subtract(11, "week").startOf("week"), dayjs()],
	month: () => [dayjs().subtract(11, "month").startOf("month"), dayjs()],
	year: () => [dayjs().subtract(4, "year").startOf("year"), dayjs()],
};

/**
 * Màu trạng thái cho CỘT biểu đồ — cùng tông với nhãn trạng thái (INCIDENT_STATUS_COLOR) nhưng
 * đậm / nhạt lại để đủ tương phản trên nền sáng / tối và phân biệt được với người mù màu
 * (đã chạy bộ kiểm tra bảng màu cho cả hai chế độ).
 */
const STATUS_CHART_COLOR: Record<"light" | "dark", Record<IncidentStatus, string>> = {
	light: { PROCESSING: "#C98300", PENDING_APPROVAL: "#0090AE", COMPLETED: "#15993F" },
	dark: { PROCESSING: "#C98300", PENDING_APPROVAL: "#00A5C4", COMPLETED: "#1FB155" },
};
const STATUS_TONE: Record<IncidentStatus, "warning" | "info" | "success"> = {
	PROCESSING: "warning",
	PENDING_APPROVAL: "info",
	COMPLETED: "success",
};

const PICKER_FORMAT: Record<ReportPeriod, string | undefined> = {
	day: "DD/MM/YYYY",
	week: undefined, // mặc định của antd: "2026-42th"
	month: "MM/YYYY",
	year: "YYYY",
};

/** Chọn theo tuần / tháng / năm thì lấy TRỌN kỳ: đầu kỳ của mốc đầu → cuối kỳ của mốc cuối. */
function normalizeRange([a, b]: [Dayjs, Dayjs], period: ReportPeriod): [Dayjs, Dayjs] {
	if (period === "day") return [a, b];
	const unit = period === "week" ? "week" : period === "month" ? "month" : "year";
	return [a.startOf(unit), b.endOf(unit)];
}

function bucketLabel(bucket: string, period: ReportPeriod, short = false): string {
	const d = dayjs(bucket);
	if (period === "year") return d.format("YYYY");
	if (period === "month") return d.format(short ? "MM/YY" : "MM/YYYY");
	if (period === "week") return `${d.format("DD/MM")}–${d.add(6, "day").format("DD/MM")}`;
	return d.format(short ? "DD/MM" : "DD/MM/YYYY");
}

/** Thống kê sự vụ theo ngày / tuần / tháng / năm + xuất Excel báo cáo. */
export default function IncidentStatsView() {
	const { t } = useTranslation();
	const { themeMode } = useSettings();
	const colors = STATUS_CHART_COLOR[themeMode === ThemeMode.Dark ? "dark" : "light"];

	const [period, setPeriod] = useState<ReportPeriod>("day");
	const [range, setRange] = useState<[Dayjs, Dayjs]>(DEFAULT_RANGE.day);
	const [tenantId, setTenantId] = useState<number | undefined>();
	const query = {
		period,
		date_from: range[0].format("YYYY-MM-DD"),
		date_to: range[1].format("YYYY-MM-DD"),
		tenant_id: tenantId,
	};

	const { data, isFetching, error } = useQuery({
		queryKey: ["incident-report", query],
		queryFn: () => incidentService.reportStats(query),
		placeholderData: keepPreviousData,
	});
	const exportXlsx = useMutation({
		mutationFn: () => incidentService.reportExport(query),
		onSuccess: ({ blob, filename }) => downloadBlob(blob, filename),
	});

	const series = data?.series ?? [];
	const categories = series.map((b) => bucketLabel(b.bucket, period, true));
	const timeChart = useChart({
		chart: { stacked: true, toolbar: { show: false }, zoom: { enabled: false } },
		colors: INCIDENT_STATUSES.map((s) => colors[s]),
		plotOptions: {
			bar: { columnWidth: series.length > 20 ? "70%" : "45%", borderRadius: 4, borderRadiusApplication: "end" },
		},
		// Viền theo màu nền = khe 2px giữa các đoạn chồng nhau.
		stroke: { show: true, width: 2, colors: ["var(--card, #fff)"] },
		dataLabels: { enabled: false },
		xaxis: {
			categories,
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
					o ? bucketLabel(series[o.dataPointIndex]?.bucket ?? "", period) : "",
			},
		},
		grid: { strokeDashArray: 3 },
	});
	const timeSeries = INCIDENT_STATUSES.map((s) => ({
		name: t(`incident.status.${s}`),
		data: series.map((b) => b[s]),
	}));

	const tenants = data?.by_tenant ?? [];
	const tenantChart = useChart({
		chart: { toolbar: { show: false } },
		colors: [colors.PENDING_APPROVAL],
		plotOptions: {
			bar: {
				horizontal: true,
				barHeight: "60%",
				borderRadius: 4,
				borderRadiusApplication: "end",
				dataLabels: { position: "top" },
			},
		},
		// Số đặt NGOÀI đầu thanh (thanh ngắn không chứa nổi chữ), màu chữ theo giao diện.
		dataLabels: {
			enabled: true,
			offsetX: 22,
			style: { colors: [themeMode === ThemeMode.Dark ? "#E5E7EB" : "#1C252E"], fontWeight: 600 },
		},
		xaxis: {
			categories: tenants.map((x) => x.tenant_name),
			// Chừa chỗ cho số đặt ngoài đầu thanh dài nhất.
			max: Math.max(5, Math.ceil(Math.max(0, ...tenants.map((x) => x.total)) * 1.2)),
			labels: { formatter: (v: string) => `${Math.round(Number(v))}` },
		},
		yaxis: { labels: { maxWidth: 190 } },
		legend: { show: false },
		tooltip: { y: { formatter: (v: number) => t("incident.stats.count", { count: v }) } },
		grid: { strokeDashArray: 3, padding: { right: 24 } },
	});

	const columns: ColumnsType<IncidentReportBucket> = [
		{
			title: t(`incident.stats.periodCol.${period}`),
			dataIndex: "bucket",
			render: (b: string) => bucketLabel(b, period),
		},
		{ title: t("incident.stats.total"), dataIndex: "total", align: "right", render: (v: number) => <b>{v}</b> },
		...INCIDENT_STATUSES.map((s) => ({
			title: t(`incident.status.${s}`),
			dataIndex: s,
			align: "right" as const,
		})),
	];
	const nonEmpty = useMemo(() => series.filter((b) => b.total > 0).reverse(), [series]);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<Segmented
					value={period}
					onChange={(v) => {
						setPeriod(v as ReportPeriod);
						setRange(DEFAULT_RANGE[v as ReportPeriod]());
					}}
					options={PERIODS.map((p) => ({ value: p, label: t(`incident.stats.period.${p}`) }))}
				/>
				<RangePicker
					allowClear={false}
					value={range}
					format={PICKER_FORMAT[period]}
					picker={period === "day" ? "date" : period}
					onChange={(v) => v?.[0] && v[1] && setRange(normalizeRange([v[0], v[1]], period))}
					disabledDate={(d) => d.isAfter(dayjs(), "day")}
				/>
				<OrgUnitFilter value={tenantId} onChange={setTenantId} />
				<Button className="ml-auto" onClick={() => exportXlsx.mutate()} disabled={exportXlsx.isPending}>
					<Icon icon="vscode-icons:file-type-excel" size={18} />
					{t("incident.stats.export")}
				</Button>
			</div>
			{error && <p className="text-sm text-error">{(error as Error).message}</p>}

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<StatCard
					title={t("incident.stats.total")}
					value={data?.total}
					icon="solar:siren-rounded-bold-duotone"
					loading={!data}
				/>
				{INCIDENT_STATUSES.map((s) => (
					<StatCard
						key={s}
						title={t(`incident.status.${s}`)}
						value={data?.by_status[s]}
						icon={
							s === "COMPLETED"
								? "solar:check-circle-bold-duotone"
								: s === "PENDING_APPROVAL"
									? "solar:hourglass-bold-duotone"
									: "solar:running-round-bold-duotone"
						}
						tone={STATUS_TONE[s]}
						loading={!data}
					/>
				))}
			</div>

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
				<Card className="xl:col-span-2">
					<CardHeader>
						<CardTitle>
							{t("incident.stats.overTime", { period: t(`incident.stats.period.${period}`).toLowerCase() })}
						</CardTitle>
					</CardHeader>
					<CardContent className={isFetching ? "opacity-60 transition-opacity" : ""}>
						<Chart type="bar" series={timeSeries} options={timeChart} height={320} />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{t("incident.stats.topUnits")}</CardTitle>
					</CardHeader>
					<CardContent>
						{tenants.length ? (
							<Chart
								type="bar"
								series={[{ name: t("incident.stats.total"), data: tenants.map((x) => x.total) }]}
								options={tenantChart}
								height={Math.max(160, tenants.length * 36 + 40)}
							/>
						) : (
							<p className="py-10 text-center text-sm text-text-secondary">{t("incident.stats.empty")}</p>
						)}
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t("incident.stats.table")}</CardTitle>
				</CardHeader>
				<CardContent>
					<Table<IncidentReportBucket>
						size="small"
						rowKey="bucket"
						columns={columns}
						dataSource={nonEmpty}
						loading={isFetching}
						pagination={nonEmpty.length > 15 ? { pageSize: 15, size: "small" } : false}
						locale={{ emptyText: t("incident.stats.empty") }}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
