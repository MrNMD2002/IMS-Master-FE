import { useTranslation } from "react-i18next";
import { ThemeMode } from "#/enum";
import { Icon } from "@/components/icon";
import { useSettingActions, useSettings } from "@/store/settingStore";
import { Button } from "@/ui/button";

/** Nút chuyển nhanh Sáng / Tối trên thanh tiêu đề. */
export default function ThemeToggle() {
	const { t } = useTranslation();
	const settings = useSettings();
	const { setSettings } = useSettingActions();
	const isDark = settings.themeMode === ThemeMode.Dark;

	return (
		<Button
			variant="ghost"
			size="icon"
			className="rounded-full"
			title={isDark ? t("sys.header.lightMode") : t("sys.header.darkMode")}
			onClick={() => setSettings({ ...settings, themeMode: isDark ? ThemeMode.Light : ThemeMode.Dark })}
		>
			<Icon icon={isDark ? "local:ic-settings-mode-sun" : "local:ic-settings-mode-moon"} size={22} />
		</Button>
	);
}
