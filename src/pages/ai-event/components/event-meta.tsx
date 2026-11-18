import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { AiEvent } from "#/vigil";
import { Icon } from "@/components/icon";
import { isAiPluginShown } from "@/constants/ai-plugins";
import { cn } from "@/utils";
import { fmtDuration } from "@/utils/format";

/**
 * Một chỗ duy nhất cho tên / màu / biểu tượng của plugin và loại sự kiện Vigil.
 * Tên hiển thị lấy theo i18n (`aiEvent.plugin.*`, `aiEvent.type.*`, `aiEvent.cls.*`); loại chưa
 * biết thì rơi về tên gốc do trạm gửi lên.
 */

/** Plugin Vigil thật (tên kỹ thuật) — chỉ những plugin đang mở trên CMC (`PLUGIN_PERMISSION`). */
export const KNOWN_PLUGINS = [
	"people_counting",
	"crowd_detection",
	"smoke_fire_detection",
	"zone_intrusion",
	"parking_violation_detection",
	"traffic_violation_detection",
].filter(isAiPluginShown);

export const pluginLabel = (t: TFunction, name: string) => t(`aiEvent.plugin.${name}`, { defaultValue: name });
export const eventTypeLabel = (t: TFunction, type: string) => t(`aiEvent.type.${type}`, { defaultValue: type });
/** Lớp đối tượng ("Fire" / "car" …) — không phân biệt hoa thường. */
export const classLabel = (t: TFunction, cls: string) => t(`aiEvent.cls.${cls.toLowerCase()}`, { defaultValue: cls });

/** Màu + biểu tượng theo loại sự kiện (dùng chung cho nhãn, khung bbox và biểu đồ). */
export const EVENT_META: Record<string, { color: string; icon: string; tone: string }> = {
	people_count: {
		color: "#7635DC",
		icon: "solar:users-group-two-rounded-bold-duotone",
		tone: "bg-[#7635DC]/15 text-[#7635DC] dark:text-[#B985F4]",
	},
	crowd: {
		color: "#DB2777",
		icon: "solar:users-group-rounded-bold-duotone",
		tone: "bg-[#DB2777]/15 text-[#BE185D] dark:text-[#F472B6]",
	},
	fire: { color: "#D93A1F", icon: "solar:fire-bold-duotone", tone: "bg-error/15 text-error" },
	smoke: {
		color: "#B7791F",
		icon: "solar:cloud-bold-duotone",
		tone: "bg-warning/20 text-warning-dark dark:text-warning",
	},
	zone_intrusion: {
		color: "#C2410C",
		icon: "solar:shield-warning-bold-duotone",
		tone: "bg-[#C2410C]/15 text-[#C2410C] dark:text-[#FB923C]",
	},
	illegal_parking: {
		color: "#0090AE",
		icon: "mdi:parking",
		tone: "bg-info/15 text-info-dark dark:text-info",
	},
	red_light: {
		color: "#1D4ED8",
		icon: "mdi:traffic-light",
		tone: "bg-[#1D4ED8]/15 text-[#1D4ED8] dark:text-[#93B4FF]",
	},
	wrong_way: {
		color: "#15803D",
		icon: "mdi:car-arrow-left",
		tone: "bg-[#15803D]/15 text-[#15803D] dark:text-[#6EE7A0]",
	},
};
const FALLBACK = { color: "#637381", icon: "solar:bell-bold-duotone", tone: "bg-muted text-text-secondary" };
export const eventMeta = (type: string) => EVENT_META[type] ?? FALLBACK;

/** Màu khung theo lớp đối tượng. */
const CLASS_COLOR: Record<string, string> = {
	fire: "#FF5630",
	smoke: "#FFAB00",
	person: "#22C55E",
	car: "#00B8D9",
	truck: "#00B8D9",
	bus: "#00B8D9",
	motorbike: "#8E33FF",
};
export const classColor = (cls: string) => CLASS_COLOR[cls.toLowerCase()] ?? "#FF7A00";

export function EventTypeTag({ type, className }: { type: string; className?: string }) {
	const { t } = useTranslation();
	const m = eventMeta(type);
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
				m.tone,
				className,
			)}
		>
			<Icon icon={m.icon} size={14} />
			{eventTypeLabel(t, type)}
		</span>
	);
}

export function ScoreText({ score }: { score: number }) {
	const pct = Math.round(score * 100);
	return (
		<span
			className={cn(
				"font-mono text-sm tabular-nums",
				pct >= 85 ? "font-semibold" : pct < 65 ? "text-text-secondary" : undefined,
			)}
		>
			{pct}%
		</span>
	);
}

/** Tên lớp đối tượng ("person" → "Người"). */
export function useClassLabel() {
	const { t } = useTranslation();
	return (cls: string) => classLabel(t, cls);
}

const num = (v: unknown) => (typeof v === "number" ? v : undefined);
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

/** Biển số kiểu tấm biển trắng viền đen. */
export function PlateText({ plate, large }: { plate: string; large?: boolean }) {
	return (
		<span
			className={cn(
				"inline-block whitespace-nowrap rounded border-2 border-gray-900 bg-white font-mono font-bold tracking-wide text-gray-900",
				large ? "px-3 py-1 text-2xl" : "px-1.5 py-px text-xs",
			)}
		>
			{plate}
		</span>
	);
}

/** Tóm tắt một dòng (dưới nhãn loại trong bảng): số người, thời gian đỗ, biển số… */
export function useEventSummary() {
	const { t } = useTranslation();
	return (e: AiEvent): ReactNode => {
		const x = e.extra ?? {};
		switch (e.event_type) {
			case "people_count":
				return num(x.count) != null ? t("aiEvent.summary.people", { count: num(x.count) }) : null;
			case "crowd":
				return t("aiEvent.summary.crowd", {
					n: num(x.count) ?? "—",
					threshold: num(x.threshold) ?? "—",
					dur: fmtDuration(num(x.sustained_secs), t),
				});
			case "illegal_parking":
				return t("aiEvent.summary.parking", {
					vehicle: classLabel(t, str(x.vehicle_class) ?? e.objects[0]?.class ?? "car"),
					dur: fmtDuration(num(x.dwell_total_seconds) ?? num(x.parked_secs), t),
				});
			case "red_light":
			case "wrong_way":
				return str(x.plate_text) ? <PlateText plate={str(x.plate_text) as string} /> : t("aiEvent.highlight.noPlate");
			case "zone_intrusion":
				return (num(x.dwell_total_seconds) ?? num(x.dwell_seconds)) != null
					? t("aiEvent.summary.dwell", { dur: fmtDuration(num(x.dwell_total_seconds) ?? num(x.dwell_seconds), t) })
					: null;
			case "fire":
			case "smoke":
				return num(x.frames) != null ? t("aiEvent.summary.frames", { n: num(x.frames) }) : null;
			default:
				return [...new Set(e.objects.map((o) => classLabel(t, o.class)))].join(", ");
		}
	};
}

/** Số liệu nổi bật của sự kiện cho hộp chi tiết (không hiện gì nếu loại này không có). */
export function EventHighlight({ event: e }: { event: AiEvent }) {
	const { t } = useTranslation();
	const x = e.extra ?? {};
	const color = eventMeta(e.event_type).color;
	let label: string | null = null;
	let value: ReactNode = null;
	if (e.event_type === "people_count" && num(x.count) != null) {
		label = t("aiEvent.highlight.people");
		value = num(x.count);
	} else if (e.event_type === "crowd" && num(x.count) != null) {
		label = t("aiEvent.highlight.crowd", { threshold: num(x.threshold) ?? "—" });
		value = num(x.count);
	} else if (e.event_type === "illegal_parking" && (num(x.dwell_total_seconds) ?? num(x.parked_secs)) != null) {
		label = t("aiEvent.highlight.parked");
		value = fmtDuration(num(x.dwell_total_seconds) ?? num(x.parked_secs), t);
	} else if (e.event_type === "red_light" || e.event_type === "wrong_way") {
		label = t("aiEvent.highlight.plate");
		value = str(x.plate_text) ? (
			<PlateText plate={str(x.plate_text) as string} large />
		) : (
			<span className="text-base text-text-secondary">{t("aiEvent.highlight.noPlate")}</span>
		);
	}
	if (!label) return null;
	return (
		<div className="rounded-xl border p-4" style={{ borderColor: `${color}66`, background: `${color}0f` }}>
			<p className="mb-1 text-sm text-text-secondary">{label}</p>
			<div className="text-3xl font-bold tabular-nums" style={{ color }}>
				{value}
			</div>
		</div>
	);
}
