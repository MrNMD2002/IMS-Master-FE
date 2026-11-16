import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AiObject } from "#/vigil";
import { eventImageUrl } from "@/api/services/aiStationService";
import { Icon } from "@/components/icon";
import { cn } from "@/utils";
import { classColor, useClassLabel } from "./event-meta";

const pct = (v: number) => `${Math.min(100, Math.max(0, v * 100))}%`;

/** Tải ảnh bằng chứng kèm token (xem `eventImageUrl`), thu hồi blob URL khi đổi ảnh / gỡ. */
export function useEventImage(src: string | null) {
	const [url, setUrl] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);
	useEffect(() => {
		setFailed(false);
		setUrl(null);
		if (!src) return;
		let alive = true;
		let blobUrl: string | null = null;
		eventImageUrl(src)
			.then((r) => {
				if (r.blob) blobUrl = r.url;
				if (alive) setUrl(r.url);
				else if (r.blob) URL.revokeObjectURL(r.url);
			})
			.catch(() => alive && setFailed(true));
		return () => {
			alive = false;
			if (blobUrl) URL.revokeObjectURL(blobUrl);
		};
	}, [src]);
	return { url, failed, loading: !!src && !url && !failed };
}

/**
 * Ảnh bằng chứng + khung bbox vẽ đè. bbox chuẩn hoá 0..1 nên đặt theo % trên chính khung ảnh —
 * ảnh co giãn bao nhiêu khung vẫn khớp. `compact` = ảnh thu nhỏ trong bảng (không nhãn chữ).
 */
export default function EventImage({
	src,
	objects,
	showBoxes = true,
	compact,
	className,
	alt,
}: {
	src: string | null;
	objects: AiObject[];
	showBoxes?: boolean;
	compact?: boolean;
	className?: string;
	alt?: string;
}) {
	const { t } = useTranslation();
	const label = useClassLabel();
	const { url, failed: loadFailed, loading } = useEventImage(src);
	const [failed, setFailed] = useState(false);

	if (loading) {
		return <div className={cn("aspect-video w-full animate-pulse rounded-md bg-muted", className)} />;
	}
	if (!url || failed || loadFailed) {
		return (
			<div
				className={cn(
					"flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-md bg-muted text-text-disabled",
					className,
				)}
			>
				<Icon icon="solar:gallery-remove-bold-duotone" size={compact ? 20 : 40} />
				{!compact && <span className="text-sm">{t("aiEvent.noImage")}</span>}
			</div>
		);
	}

	return (
		<div className={cn("relative w-full overflow-hidden rounded-md bg-black", className)}>
			<img
				src={url}
				alt={alt ?? ""}
				loading="lazy"
				className="block h-auto w-full select-none"
				draggable={false}
				onError={() => setFailed(true)}
			/>
			{showBoxes &&
				objects.map((o, i) => {
					const color = classColor(o.class);
					return (
						<div
							key={`${o.track_id ?? "x"}-${i}`}
							className="pointer-events-none absolute"
							style={{
								left: pct(o.bbox.x),
								top: pct(o.bbox.y),
								width: pct(o.bbox.w),
								height: pct(o.bbox.h),
								border: `${compact ? 1 : 2}px solid ${color}`,
								boxShadow: compact ? undefined : "0 0 0 1px rgba(0,0,0,.35)",
							}}
						>
							{!compact && (
								<span
									className="absolute left-[-2px] whitespace-nowrap rounded-sm px-1 py-px text-[11px] font-semibold leading-tight text-white"
									// Khung sát mép trên → nhãn vào trong khung cho khỏi bị cắt.
									style={o.bbox.y < 0.05 ? { background: color, top: 0 } : { background: color, bottom: "100%" }}
								>
									{label(o.class)} {Math.round(o.score * 100)}%{o.track_id != null && ` · #${o.track_id}`}
								</span>
							)}
						</div>
					);
				})}
		</div>
	);
}
