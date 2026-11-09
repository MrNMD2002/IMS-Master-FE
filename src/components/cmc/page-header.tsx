import { type ReactNode, useEffect, useRef } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/utils";

interface Props {
	title: ReactNode;
	description?: ReactNode;
	icon?: string;
	actions?: ReactNode;
	/** Thanh tìm kiếm / bộ lọc — ghim cùng tiêu đề khi cuộn. */
	toolbar?: ReactNode;
	className?: string;
}

/**
 * Khối ghim ngay dưới thanh trên cùng khi cuộn. Kéo tràn sang hai bên đúng bằng lề của khung
 * nội dung (layouts/dashboard/main.tsx) để nền phủ kín, nội dung cuộn qua bên dưới.
 */
export const STICKY_PAGE_BAR =
	"sticky top-[var(--layout-header-height)] z-[9] -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 -mt-4 pt-4 sm:-mt-6 sm:pt-6 pb-3 bg-background/90 backdrop-blur-xl";

/**
 * Chiều cao khối ghim hiện tại, công bố qua biến CSS `--page-bar-h` để phần khác dính ngay
 * bên dưới (vd cột danh sách vai trò): `top-[calc(var(--layout-header-height)+var(--page-bar-h))]`.
 */
function usePublishBarHeight() {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const root = document.documentElement;
		const ro = new ResizeObserver(() => root.style.setProperty("--page-bar-h", `${el.offsetHeight}px`));
		ro.observe(el);
		return () => {
			ro.disconnect();
			root.style.removeProperty("--page-bar-h");
		};
	}, []);
	return ref;
}

/** Tiêu đề trang (+ thanh lọc nếu có) — luôn ghim đầu trang. */
export default function PageHeader({ title, description, icon, actions, toolbar, className }: Props) {
	const ref = usePublishBarHeight();
	return (
		<div ref={ref} className={cn(STICKY_PAGE_BAR, "mb-2 flex flex-col gap-3", className)}>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-3 min-w-0">
					{icon && (
						<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<Icon icon={icon} size={24} />
						</span>
					)}
					<div className="min-w-0">
						<h1 className="text-xl font-bold leading-tight truncate">{title}</h1>
						{description && <p className="text-sm text-text-secondary truncate">{description}</p>}
					</div>
				</div>
				{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
			</div>
			{toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
		</div>
	);
}
