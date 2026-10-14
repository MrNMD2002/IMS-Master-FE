import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { Card } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";
import { cn } from "@/utils";

type Tone = "primary" | "info" | "warning" | "error" | "success";

const TONE: Record<Tone, string> = {
	primary: "bg-primary/10 text-primary",
	info: "bg-info/10 text-info",
	warning: "bg-warning/10 text-warning-dark dark:text-warning",
	error: "bg-error/10 text-error",
	success: "bg-success/10 text-success",
};

interface Props {
	title: ReactNode;
	value?: number | string | null;
	icon: string;
	tone?: Tone;
	hint?: ReactNode;
	loading?: boolean;
	onClick?: () => void;
	/** Bản gọn khi khối số liệu đang ghim và trang đã cuộn. */
	compact?: boolean;
}

export default function StatCard({ title, value, icon, tone = "primary", hint, loading, onClick, compact }: Props) {
	return (
		<Card
			onClick={onClick}
			className={cn(
				"flex-row items-center transition-[padding] duration-200",
				compact ? "gap-3 px-4 py-2.5" : "gap-4 px-5 py-5",
				onClick && "cursor-pointer transition-shadow hover:shadow-md",
			)}
		>
			<span
				className={cn(
					"flex shrink-0 items-center justify-center rounded-2xl",
					compact ? "h-9 w-9" : "h-12 w-12",
					TONE[tone],
				)}
			>
				<Icon icon={icon} size={compact ? 20 : 26} />
			</span>
			<div className="min-w-0 flex-1">
				<p className={cn("text-text-secondary truncate", compact ? "text-xs" : "text-sm")}>{title}</p>
				{loading ? (
					<Skeleton className="mt-1 h-7 w-16" />
				) : (
					<p className={cn("font-bold leading-tight", compact ? "text-lg" : "text-2xl")}>{value ?? "—"}</p>
				)}
				{hint && !compact && <p className="mt-0.5 text-xs text-text-disabled truncate">{hint}</p>}
			</div>
		</Card>
	);
}
