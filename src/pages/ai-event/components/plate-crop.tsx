import { Spin, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { AiEvent } from "#/vigil";
import { Icon } from "@/components/icon";
import { cn } from "@/utils";
import { useEventImage } from "./event-image";
import { PlateText } from "./event-meta";

/** `extra.plate` trạm gửi khi khoanh được biển số (model `mbfsn_lp_det_v8`). */
export interface PlateInfo {
	lines?: number;
	kind?: string;
	score?: number;
	text?: string | null;
	/** Độ tin cậy của chữ đọc được (0..1). */
	text_conf?: number;
}

export function plateInfo(e: Pick<AiEvent, "extra">): PlateInfo | null {
	const p = e.extra?.plate;
	return p && typeof p === "object" ? (p as PlateInfo) : null;
}

/**
 * Ảnh biển số trạm cắt ra (ảnh `crop` của sự kiện) + chữ trạm đọc được + loại biển. Chữ tin
 * cậy thấp vẫn hiện nhưng kèm cảnh báo, người xem đối chiếu ảnh. `compact` = ô nhỏ trong bảng.
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
	const textConf = typeof info?.text_conf === "number" ? info.text_conf : 0;
	return (
		<div className="flex flex-col gap-1.5">
			{info?.text && (
				<span className="flex flex-wrap items-center gap-2">
					<PlateText plate={info.text} />
					<span className={cn("text-xs", textConf < 0.5 ? "text-warning" : "text-text-secondary")}>
						{t(textConf < 0.5 ? "aiEvent.plate.lowConf" : "aiEvent.plate.textConf", {
							score: `${Math.round(textConf * 100)}%`,
						})}
					</span>
				</span>
			)}
			{img}
			<span className="text-xs text-text-secondary">
				{label}
				{score && ` · ${t("aiEvent.plate.score", { score })}`}
			</span>
			{!info?.text && <span className="text-xs text-text-disabled">{t("aiEvent.plate.noText")}</span>}
		</div>
	);
}
