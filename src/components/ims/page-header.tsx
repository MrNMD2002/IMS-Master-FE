import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/utils";

interface Props {
	title: ReactNode;
	description?: ReactNode;
	icon?: string;
	actions?: ReactNode;
	className?: string;
}

/**
 * Thanh tiêu đề ghim ngay dưới thanh trên cùng khi cuộn. Kéo tràn sang hai bên đúng bằng
 * lề của khung nội dung (layouts/dashboard/main.tsx) để nền phủ kín, nội dung cuộn qua bên dưới.
 */
export const STICKY_PAGE_BAR =
	"sticky top-[var(--layout-header-height)] z-[9] -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 -mt-4 pt-4 sm:-mt-6 sm:pt-6 pb-3 bg-background/90 backdrop-blur-xl";

/** Tiêu đề trang: icon + tên + mô tả ngắn, nút thao tác bên phải — luôn ghim đầu trang. */
export default function PageHeader({ title, description, icon, actions, className }: Props) {
	return (
		<div className={cn(STICKY_PAGE_BAR, "mb-2 flex flex-wrap items-center justify-between gap-3", className)}>
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
	);
}
