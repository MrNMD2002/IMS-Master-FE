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
}

export default function StatCard({ title, value, icon, tone = "primary", hint, loading, onClick }: Props) {
	return (
		<Card
			onClick={onClick}
			className={cn(
				"flex-row items-center gap-4 px-5 py-5",
				onClick && "cursor-pointer transition-shadow hover:shadow-md",
			)}
		>
			<span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", TONE[tone])}>
				<Icon icon={icon} size={26} />
			</span>
			<div className="min-w-0 flex-1">
				<p className="text-sm text-text-secondary truncate">{title}</p>
				{loading ? (
					<Skeleton className="mt-1 h-7 w-16" />
				) : (
					<p className="text-2xl font-bold leading-tight">{value ?? "—"}</p>
				)}
				{hint && <p className="mt-0.5 text-xs text-text-disabled truncate">{hint}</p>}
			</div>
		</Card>
	);
}
