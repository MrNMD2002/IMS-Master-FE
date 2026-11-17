import { Spin, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { AiEvent } from "#/vigil";
import { Icon } from "@/components/icon";
import { cn } from "@/utils";
import { useEventImage } from "./event-image";

/** `extra.plate` trạm gửi khi khoanh được biển số (model `lp_det_v8`). */
export interface PlateInfo {
	lines?: number;
	kind?: string;
	score?: number;
	text?: string | null;
}

export function plateInfo(e: Pick<AiEvent, "extra">): PlateInfo | null {
	const p = e.extra?.plate;
	return p && typeof p === "object" ? (p as PlateInfo) : null;
}

/**
 * Ảnh biển số trạm cắt ra (ảnh `crop` của sự kiện) + loại biển. Model hiện chỉ khoanh vùng,
 * chưa đọc chữ — người xem đọc trên ảnh. `compact` = ô nhỏ trong bảng.
 */
export default function PlateCrop({
	src,
	info,
	compact,
}: {
	src: string | null | undefined;
	info: PlateInfo | null;
	compact?: boolean;
}) {
	const { t } = useTranslation();
	const { url, failed, loading } = useEventImage(src ?? null);
	const lines = info?.lines === 2 ? 2 : 1;
	const label = t(`aiEvent.plate.lines${lines}`);
	const score = typeof info?.score === "number" ? `${Math.round(info.score * 100)}%` : null;

	const img = (
		<div
			className={cn(
				"flex items-center justify-center overflow-hidden rounded border bg-black/80",
				compact ? "h-9 w-24" : "h-24 w-56",
			)}
		>
			{loading ? (
				<Spin size="small" />
			) : url && !failed ? (
				<img src={url} alt={label} className="h-full w-full object-contain" />
			) : (
				<Icon icon="solar:gallery-remove-linear" size={compact ? 16 : 24} className="text-white/60" />
			)}
		</div>
	);

	if (compact) {
		return <Tooltip title={score ? `${label} · ${score}` : label}>{img}</Tooltip>;
	}
	return (
		<div className="flex flex-col gap-1.5">
			{img}
			<span className="text-xs text-text-secondary">
				{label}
				{score && ` · ${t("aiEvent.plate.score", { score })}`}
			</span>
			<span className="text-xs text-text-disabled">{t("aiEvent.plate.noText")}</span>
		</div>
	);
}
