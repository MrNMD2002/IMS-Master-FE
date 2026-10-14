import { useUserInfo, useUserToken } from "@/store/userStore";

/**
 * permission/role check hook
 * @param baseOn - check type: 'role' or 'permission'
 *
 * @example
 * // permission check
 * const { check, checkAny, checkAll } = useAuthCheck('permission');
 * check('user.create')
 * checkAny(['user.create', 'user.edit'])
 * checkAll(['user.create', 'user.edit'])
 *
 * @example
 * // role check
 * const { check, checkAny, checkAll } = useAuthCheck('role');
 * check('admin')
 * checkAny(['admin', 'editor'])
 * checkAll(['admin', 'editor'])
 */
export const useAuthCheck = (baseOn: "role" | "permission" = "permission") => {
	const { access_token } = useUserToken();
	const { permissions = [], role } = useUserInfo();

	const check = (item: string): boolean => {
		if (!access_token) return false;
		if (baseOn === "role") return role === item;
		return permissions.some((p) => p === item);
	};

	// check if any item exists
	const checkAny = (items: string[]) => {
		if (items.length === 0) {
			return true;
		}
		return items.some((item) => check(item));
	};

	// check if all items exist
	const checkAll = (items: string[]) => {
		if (items.length === 0) {
			return true;
		}
		return items.every((item) => check(item));
	};

	return { check, checkAny, checkAll };
};
