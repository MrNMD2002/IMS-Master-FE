import type { ColumnsType } from "antd/es/table";
import type { TFunction } from "i18next";
import type { AiEvent, AiEventStats } from "#/vigil";
import { fmtDuration } from "@/utils/format";
import { classLabel, EventTypeTag, PlateText } from "../ai-event/components/event-meta";

/**
 * Trang riêng của từng plugin Vigil (theo cách hệ tham khảo chia menu theo chức năng: mỗi chức
 * năng có "Danh sách" + "Thống kê"). Mỗi plugin khai báo cột số liệu riêng lấy từ `extra` và các
 * ô chỉ số cho trang thống kê; phần khung (bộ lọc, bảng, biểu đồ) dùng chung.
 */

export type PluginGroup = "security" | "traffic";

export interface Kpi {
	title: string;
	value: string | number | null | undefined;
	hint?: string;
	icon: string;
	tone: "primary" | "info" | "success" | "warning" | "error";
}

export interface PluginPage {
	/** Tên kỹ thuật Vigil gửi lên (`AiEvent.plugin`). */
	name: string;
	/** Đoạn đường dẫn: `/ai/p/<slug>`. */
	slug: string;
	group: PluginGroup;
	icon: string;
	/** Loại sự kiện plugin phát ra — nhiều hơn một thì giữ cột loại / lọc theo loại. */
	types: string[];
	columns: (t: TFunction) => ColumnsType<AiEvent>;
	kpis: (s: AiEventStats | undefined, t: TFunction) => Kpi[];
}

const num = (v: unknown) => (typeof v === "number" ? v : undefined);
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const dash = <span className="text-text-disabled">—</span>;

const countCol = (t: TFunction): ColumnsType<AiEvent>[number] => ({
	title: t("aiPlugin.col.people"),
	key: "count",
	align: "center",
	render: (_, e) => {
		const n = num(e.extra?.count);
		return n != null ? <span className="text-base font-semibold tabular-nums">{n}</span> : dash;
	},
});

const durationCol = (t: TFunction, key: string, title: string): ColumnsType<AiEvent>[number] => ({
	title,
	key,
	align: "center",
	render: (_, e) => {
		const s = num(e.extra?.[key]);
		return s != null ? <span className="whitespace-nowrap tabular-nums">{fmtDuration(s, t)}</span> : dash;
	},
});

const durationText = (s: number | null | undefined, t: TFunction) => (s == null ? "—" : fmtDuration(s, t));

export const PLUGIN_PAGES: PluginPage[] = [
	{
		name: "smoke_fire_detection",
		slug: "smoke-fire",
		group: "security",
		icon: "solar:fire-bold-duotone",
		types: ["fire", "smoke"],
		columns: (t) => [
			{
				title: t("aiEvent.field.type"),
				key: "type",
				render: (_, e) => <EventTypeTag type={e.event_type} />,
			},
			{
				title: t("aiPlugin.col.frames"),
				key: "frames",
				align: "center",
				render: (_, e) => <span className="tabular-nums">{num(e.extra?.frames) ?? "—"}</span>,
			},
		],
		kpis: (s, t) => {
			const by = (k: string) => (s ? (s.by_type.find((x) => x.event_type === k)?.total ?? 0) : undefined);
			return [
				{ title: t("aiPlugin.kpi.fire"), value: by("fire"), icon: "solar:fire-bold-duotone", tone: "error" },
				{ title: t("aiPlugin.kpi.smoke"), value: by("smoke"), icon: "solar:cloud-bold-duotone", tone: "warning" },
			];
		},
	},
	{
		name: "crowd_detection",
		slug: "crowd",
		group: "security",
		icon: "solar:users-group-rounded-bold-duotone",
		types: ["crowd"],
		columns: (t) => [
			{
				...countCol(t),
				render: (_, e) => {
					const n = num(e.extra?.count);
					const th = num(e.extra?.threshold);
					return n != null ? (
						<span className="tabular-nums">
							<b className="text-base">{n}</b>
							{th != null && <span className="text-xs text-text-secondary"> / {th}</span>}
						</span>
					) : (
						dash
					);
				},
			},
			durationCol(t, "sustained_secs", t("aiPlugin.col.sustained")),
		],
		kpis: (s, t) => [
			{
				title: t("aiPlugin.kpi.peakPeople"),
				value: s?.peak_count,
				icon: "solar:users-group-two-rounded-bold-duotone",
				tone: "error",
			},
			{
				title: t("aiPlugin.kpi.avgSustained"),
				value: s && durationText(s.avg_duration_s, t),
				hint: s?.max_duration_s != null ? t("aiPlugin.kpi.longest", { dur: durationText(s.max_duration_s, t) }) : "",
				icon: "solar:stopwatch-bold-duotone",
				tone: "warning",
			},
		],
	},
	{
		name: "zone_intrusion",
		slug: "zone-intrusion",
		group: "security",
		icon: "solar:shield-warning-bold-duotone",
		types: ["zone_intrusion"],
		columns: (t) => [
			{
				title: t("aiPlugin.col.objects"),
				key: "objects",
				render: (_, e) => (
					<span className="text-sm">
						{[...new Set(e.objects.map((o) => classLabel(t, o.class)))].join(", ") || "—"}
					</span>
				),
			},
			durationCol(t, "dwell_seconds", t("aiPlugin.col.dwell")),
		],
		kpis: (s, t) => [
			{
				title: t("aiPlugin.kpi.avgDwell"),
				value: s && durationText(s.avg_duration_s, t),
				icon: "solar:stopwatch-bold-duotone",
				tone: "warning",
			},
			{
				title: t("aiPlugin.kpi.maxDwell"),
				value: s && durationText(s.max_duration_s, t),
				icon: "solar:hourglass-bold-duotone",
				tone: "error",
			},
		],
	},
	{
		name: "people_counting",
		slug: "people-counting",
		group: "traffic",
		icon: "solar:users-group-two-rounded-bold-duotone",
		types: ["people_count"],
		columns: (t) => [countCol(t)],
		kpis: (s, t) => [
			{
				title: t("aiPlugin.kpi.peakPeople"),
				value: s?.peak_count,
				icon: "solar:users-group-two-rounded-bold-duotone",
				tone: "info",
			},
			{
				title: t("aiPlugin.kpi.avgPeople"),
				value: s?.avg_count,
				icon: "solar:chart-2-bold-duotone",
				tone: "success",
			},
		],
	},
	{
		name: "parking_violation_detection",
		slug: "parking-violation",
		group: "traffic",
		icon: "mdi:parking",
		types: ["illegal_parking"],
		columns: (t) => [
			{
				title: t("aiPlugin.col.vehicle"),
				key: "vehicle",
				render: (_, e) => (
					<span className="text-sm">{classLabel(t, str(e.extra?.vehicle_class) ?? e.objects[0]?.class ?? "—")}</span>
				),
			},
			durationCol(t, "parked_secs", t("aiPlugin.col.parked")),
		],
		kpis: (s, t) => [
			{
				title: t("aiPlugin.kpi.avgParked"),
				value: s && durationText(s.avg_duration_s, t),
				icon: "solar:stopwatch-bold-duotone",
				tone: "warning",
			},
			{
				title: t("aiPlugin.kpi.maxParked"),
				value: s && durationText(s.max_duration_s, t),
				icon: "solar:hourglass-bold-duotone",
				tone: "error",
			},
		],
	},
	{
		name: "traffic_violation_detection",
		slug: "traffic-violation",
		group: "traffic",
		icon: "mdi:traffic-light",
		types: ["red_light", "wrong_way"],
		columns: (t) => [
			{
				title: t("aiEvent.field.type"),
				key: "type",
				render: (_, e) => <EventTypeTag type={e.event_type} />,
			},
			{
				title: t("aiPlugin.col.plate"),
				key: "plate",
				render: (_, e) => {
					const plate = str(e.extra?.plate_text);
					return plate ? (
						<PlateText plate={plate} />
					) : (
						<span className="text-xs text-text-disabled">{t("aiPlugin.col.noPlate")}</span>
					);
				},
			},
			{
				title: t("aiPlugin.col.vehicle"),
				key: "vehicle",
				render: (_, e) => (
					<span className="text-sm">{classLabel(t, str(e.extra?.vehicle_class) ?? e.objects[0]?.class ?? "—")}</span>
				),
			},
			{
				title: t("aiPlugin.col.detail"),
				key: "detail",
				render: (_, e) => {
					const red = num(e.extra?.red_for_secs);
					const angle = num(e.extra?.angle_deg);
					if (e.event_type === "red_light" && red != null)
						return <span className="text-sm">{t("aiPlugin.col.redFor", { s: red })}</span>;
					if (e.event_type === "wrong_way" && angle != null)
						return <span className="text-sm">{t("aiPlugin.col.angle", { deg: angle })}</span>;
					return dash;
				},
			},
		],
		kpis: (s, t) => {
			const by = (k: string) => (s ? (s.by_type.find((x) => x.event_type === k)?.total ?? 0) : undefined);
			return [
				{ title: t("aiPlugin.kpi.redLight"), value: by("red_light"), icon: "mdi:traffic-light", tone: "error" },
				{ title: t("aiPlugin.kpi.wrongWay"), value: by("wrong_way"), icon: "mdi:car-arrow-left", tone: "warning" },
			];
		},
	},
];

export const pluginBySlug = (slug?: string) => PLUGIN_PAGES.find((p) => p.slug === slug);
