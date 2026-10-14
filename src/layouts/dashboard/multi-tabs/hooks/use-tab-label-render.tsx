import { useTranslation } from "react-i18next";
import type { KeepAliveTab } from "../types";

export function useTabLabelRender() {
	const { t } = useTranslation();
	return (tab: KeepAliveTab) => {
		const id = tab.params?.id;
		return id ? `${t(tab.label)} #${id}` : t(tab.label);
	};
}
