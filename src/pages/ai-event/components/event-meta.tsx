import { useTranslation } from "react-i18next";
import type { AiEvent, AiObject } from "#/vigil";
import { Icon } from "@/components/icon";
import { cn } from "@/utils";

/** Plugin sinh sự kiện mà Vigil đang có (tên kỹ thuật, nhãn lấy theo i18n `aiEvent.plugin.*`). */
export const KNOWN_PLUGINS = ["smoke_fire_detection", "object_detection", "people_counting", "zone_intrusion"];

/** Màu + biểu tượng theo loại sự kiện (dùng chung cho nhãn, khung bbox và biểu đồ). */
export const EVENT_META: Record<string, { color: string; icon: string; tone: string }> = {
	fire: { color: "#D93A1F", icon: "solar:fire-bold-duotone", tone: "bg-error/15 text-error" },
	smoke: {
		color: "#B7791F",
		icon: "solar:cloud-bold-duotone",
		tone: "bg-warning/20 text-warning-dark dark:text-warning",
	},
	object_detected: {
		color: "#0090AE",
		icon: "solar:scanner-bold-duotone",
		tone: "bg-info/15 text-info-dark dark:text-info",
	},
	people_count: {
		color: "#7635DC",
		icon: "solar:users-group-two-rounded-bold-duotone",
		tone: "bg-[#7635DC]/15 text-[#7635DC] dark:text-[#B985F4]",
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
	motorbike: "#8E33FF",
};
export const classColor = (cls: string) => CLASS_COLOR[cls] ?? "#FF7A00";

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
			{t(`aiEvent.type.${type}`, { defaultValue: type })}
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
	return (cls: string) => t(`aiEvent.cls.${cls}`, { defaultValue: cls });
}

/** Tóm tắt một dòng cho sự kiện: số người, các lớp đối tượng… */
export function useEventSummary() {
	const { t } = useTranslation();
	const label = useClassLabel();
	return (e: AiEvent) => {
		const extra = e.extra ?? {};
		if (e.event_type === "people_count" && typeof extra.count === "number") {
			return t("aiEvent.summary.people", { count: extra.count, in: extra.in ?? "—", out: extra.out ?? "—" });
		}
		const counts = new Map<string, number>();
		for (const o of e.objects as AiObject[]) counts.set(o.class, (counts.get(o.class) ?? 0) + 1);
		return [...counts].map(([c, n]) => (n > 1 ? `${n} ${label(c).toLowerCase()}` : label(c))).join(", ");
	};
}
