import dayjs from "dayjs";
import "dayjs/locale/vi";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { LocalEnum, StorageEnum } from "#/enum";
import { getStringItem } from "@/utils/storage";
import en_US from "./lang/en_US";
import vi_VN from "./lang/vi_VN";

const stored = getStringItem(StorageEnum.I18N);
const defaultLng = stored === LocalEnum.en_US ? LocalEnum.en_US : LocalEnum.vi_VN;

document.documentElement.lang = defaultLng === LocalEnum.vi_VN ? "vi" : "en";
dayjs.locale(defaultLng === LocalEnum.vi_VN ? "vi" : "en");

i18n.use(initReactI18next).init({
	lng: defaultLng,
	fallbackLng: LocalEnum.vi_VN,
	interpolation: { escapeValue: false },
	resources: {
		en_US: { translation: en_US },
		vi_VN: { translation: vi_VN },
	},
});

export const { t } = i18n;
