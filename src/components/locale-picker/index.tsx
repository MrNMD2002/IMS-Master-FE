import type { LocalEnum } from "#/enum";
import { Icon } from "@/components/icon";
import useLocale, { LANGUAGE_MAP } from "@/locales/use-locale";
import { Button } from "@/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";
import { cn } from "@/utils";

type Locale = keyof typeof LocalEnum;

/** Chọn ngôn ngữ: cờ + mã ngắn (VI / EN). */
export default function LocalePicker() {
	const { setLocale, locale, t } = useLocale();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="sm" className="rounded-full gap-1.5 px-2" title={t("sys.header.language")}>
					<Icon icon={`local:${LANGUAGE_MAP[locale].icon}`} size="20" className="rounded-sm" />
					<span className="text-xs font-semibold">{LANGUAGE_MAP[locale].short}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{Object.values(LANGUAGE_MAP).map((item) => (
					<DropdownMenuItem
						key={item.locale}
						onClick={() => setLocale(item.locale as Locale)}
						className={cn(item.locale === locale && "font-semibold text-primary")}
					>
						<Icon icon={`local:${item.icon}`} size="20" className="rounded-sm" />
						{item.label}
						{item.locale === locale && <Icon icon="solar:check-circle-bold" size={16} className="ml-auto" />}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
