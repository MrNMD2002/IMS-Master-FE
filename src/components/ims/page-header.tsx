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

/** Tiêu đề trang: icon + tên + mô tả ngắn, nút thao tác bên phải. */
export default function PageHeader({ title, description, icon, actions, className }: Props) {
	return (
		<div className={cn("mb-5 flex flex-wrap items-center justify-between gap-3", className)}>
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
