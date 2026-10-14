import type { Locale as AntdLocal } from "antd/es/locale";
import en_US from "antd/locale/en_US";
import vi_VN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { LocalEnum, StorageEnum } from "#/enum";
import { setStringItem } from "@/utils/storage";

type Locale = keyof typeof LocalEnum;
type Language = {
	locale: Locale;
	icon: string;
	label: string;
	short: string;
	antdLocal: AntdLocal;
};

export const LANGUAGE_MAP: Record<Locale, Language> = {
	[LocalEnum.vi_VN]: { locale: LocalEnum.vi_VN, label: "Tiếng Việt", short: "VI", icon: "flag-vn", antdLocal: vi_VN },
	[LocalEnum.en_US]: { locale: LocalEnum.en_US, label: "English", short: "EN", icon: "flag-us", antdLocal: en_US },
};

export default function useLocale() {
	const { t, i18n } = useTranslation();

	const locale = (i18n.resolvedLanguage === LocalEnum.en_US ? LocalEnum.en_US : LocalEnum.vi_VN) as Locale;
	const language = LANGUAGE_MAP[locale];

	const setLocale = (next: Locale) => {
		i18n.changeLanguage(next);
		setStringItem(StorageEnum.I18N, next);
		document.documentElement.lang = next === LocalEnum.vi_VN ? "vi" : "en";
		dayjs.locale(next === LocalEnum.vi_VN ? "vi" : "en");
	};

	return { t, locale, language, setLocale };
}
