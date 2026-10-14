import { Icon } from "@/components/icon";

export default function EmptyState({ text, icon = "solar:inbox-line-bold-duotone" }: { text: string; icon?: string }) {
	return (
		<div className="flex flex-col items-center justify-center gap-2 py-10 text-text-disabled">
			<Icon icon={icon} size={44} />
			<p className="text-sm">{text}</p>
		</div>
	);
}
