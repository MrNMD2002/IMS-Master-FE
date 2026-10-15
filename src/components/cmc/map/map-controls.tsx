import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMap } from "react-leaflet";
import { Icon } from "@/components/icon";
import { cn } from "@/utils";

function CtrlButton({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
	return (
		<button
			type="button"
			title={title}
			onClick={onClick}
			className="flex h-9 w-9 items-center justify-center text-text-primary hover:bg-action-hover transition-colors"
		>
			{children}
		</button>
	);
}

/** Nút phóng to / thu nhỏ / về vị trí — theo phong cách giao diện, nổi trên bản đồ. */
export default function MapControls({
	className,
	onLocate,
	extra,
}: {
	className?: string;
	onLocate?: () => void;
	extra?: ReactNode;
}) {
	const { t } = useTranslation();
	const map = useMap();
	return (
		<div
			className={cn("absolute z-[500] flex flex-col gap-2", className ?? "right-3 bottom-6")}
			onDoubleClick={(e) => e.stopPropagation()}
		>
			<div className="flex flex-col overflow-hidden rounded-lg border bg-background shadow-md divide-y">
				<CtrlButton title={t("monitor.zoomIn")} onClick={() => map.zoomIn()}>
					<Icon icon="solar:add-circle-linear" size={20} />
				</CtrlButton>
				<CtrlButton title={t("monitor.zoomOut")} onClick={() => map.zoomOut()}>
					<Icon icon="solar:minus-circle-linear" size={20} />
				</CtrlButton>
			</div>
			{onLocate && (
				<div className="overflow-hidden rounded-lg border bg-background shadow-md">
					<CtrlButton title={t("monitor.fitAll")} onClick={onLocate}>
						<Icon icon="solar:full-screen-square-linear" size={20} />
					</CtrlButton>
				</div>
			)}
			{extra}
		</div>
	);
}
