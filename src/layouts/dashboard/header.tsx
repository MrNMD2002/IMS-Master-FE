import type { ReactNode } from "react";
import LocalePicker from "@/components/locale-picker";
import ThemeToggle from "@/components/theme-toggle";
import { useSettings } from "@/store/settingStore";
import { cn } from "@/utils";
import AccountDropdown from "../components/account-dropdown";
import BreadCrumb from "../components/bread-crumb";
import SearchBar from "../components/search-bar";
import SettingButton from "../components/setting-button";

interface HeaderProps {
	leftSlot?: ReactNode;
}

export default function Header({ leftSlot }: HeaderProps) {
	const { breadCrumb } = useSettings();
	return (
		<header
			data-slot="slash-layout-header"
			className={cn(
				// z-index ghi số trực tiếp: token `appBar` sinh class `z-appBar`, class `z-app-bar` cũ không có tác dụng
				// → nội dung cuộn đè lên thanh trên cùng.
				"sticky top-0 left-0 right-0 z-[10]",
				"flex items-center justify-between px-2 grow-0 shrink-0",
				"bg-background/60 backdrop-blur-xl",
				"h-[var(--layout-header-height)] ",
			)}
		>
			<div className="flex items-center">
				{leftSlot}
				<div className="hidden md:block ml-4">{breadCrumb && <BreadCrumb />}</div>
			</div>

			<div className="flex items-center gap-1">
				<SearchBar />
				<LocalePicker />
				<ThemeToggle />
				<SettingButton />
				<AccountDropdown />
			</div>
		</header>
	);
}
