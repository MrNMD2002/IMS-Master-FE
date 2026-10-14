import { useToggle } from "react-use";
import { Icon } from "@/components/icon";
import useLocale from "@/locales/use-locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/collapsible";
import { cn } from "@/utils";
import type { NavGroupProps } from "../types";
import { NavList } from "./nav-list";

export function NavGroup({ name, items }: NavGroupProps) {
	const [open, toggleOpen] = useToggle(true);

	return (
		<Collapsible open={open}>
			<CollapsibleTrigger asChild>
				<Group name={name} open={open} onClick={toggleOpen} />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<ul className="flex w-full flex-col gap-1">
					{items.map((item, index) => (
						<NavList key={item.title || index} data={item} depth={1} />
					))}
				</ul>
			</CollapsibleContent>
		</Collapsible>
	);
}

/**
 * Tiêu đề nhóm menu: chữ đậm viết hoa, mũi tên luôn hiện. Khi THU GỌN thì tô nổi (màu chủ đạo,
 * nền nhạt) để biết nhóm đang ẩn mục bên trong — trước đây chỉ còn dòng chữ xám nhỏ khó thấy.
 */
function Group({ name, open, onClick }: { name?: string; open: boolean; onClick: (nextValue: boolean) => void }) {
	const { t } = useLocale();
	return (
		name && (
			<button
				type="button"
				title={t(name)}
				className={cn(
					"group mt-3 w-full inline-flex items-center justify-between gap-2 cursor-pointer rounded-lg py-2 pl-3 pr-2",
					"transition-colors duration-200 hover:bg-action-hover",
					!open && "bg-primary/10 text-primary hover:bg-primary/15",
				)}
				onClick={() => onClick(!open)}
			>
				<span
					className={cn(
						"text-xs font-bold uppercase tracking-wider",
						open ? "text-text-secondary group-hover:text-text-primary" : "text-primary",
					)}
				>
					{t(name)}
				</span>
				<Icon
					icon="local:ic-chevron-right"
					className={cn(
						"h-4 w-4 shrink-0 transition-transform duration-200",
						open ? "rotate-90 opacity-60" : "opacity-100",
					)}
				/>
			</button>
		)
	);
}
