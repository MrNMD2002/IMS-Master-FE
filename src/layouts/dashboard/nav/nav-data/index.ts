import { useMemo } from "react";
import type { NavItemDataProps, NavProps } from "@/components/nav";
import { useUserPermissions } from "@/store/userStore";
import { checkAny } from "@/utils";
import { frontendNavData } from "./nav-data-frontend";

const filterItems = (items: NavItemDataProps[], permissions: string[]): NavItemDataProps[] =>
	items.flatMap((item) => {
		if (item.auth && !checkAny(item.auth, permissions)) return [];
		if (item.children?.length) {
			const children = filterItems(item.children, permissions);
			return children.length ? [{ ...item, children }] : [];
		}
		return [item];
	});

const filterNavData = (navData: NavProps["data"], permissions: string[]) =>
	navData
		.map((group) => {
			const filteredItems = filterItems(group.items, permissions);
			if (filteredItems.length === 0) return null;
			return { ...group, items: filteredItems };
		})
		.filter((group): group is NonNullable<typeof group> => group !== null);

export const useFilteredNavData = () => {
	const permissions = useUserPermissions();
	return useMemo(() => filterNavData(frontendNavData, permissions), [permissions]);
};
