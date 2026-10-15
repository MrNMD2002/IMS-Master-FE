import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { UserInfo, UserToken } from "#/cmc";
import { StorageEnum } from "#/enum";
import authService, { type SignInReq } from "@/api/services/authService";
import { P } from "@/constants/permission";
import { t } from "@/locales/i18n";

type UserStore = {
	userInfo: Partial<UserInfo>;
	userToken: UserToken;
	actions: {
		setUserInfo: (userInfo: UserInfo) => void;
		setUserToken: (token: UserToken) => void;
		clearUserInfoAndToken: () => void;
	};
};

const useUserStore = create<UserStore>()(
	persist(
		(set) => ({
			userInfo: {},
			userToken: {},
			actions: {
				setUserInfo: (userInfo) => set({ userInfo }),
				setUserToken: (userToken) => set({ userToken }),
				clearUserInfoAndToken: () => set({ userInfo: {}, userToken: {} }),
			},
		}),
		{
			name: "cmcUserStore",
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({
				[StorageEnum.UserInfo]: state.userInfo,
				[StorageEnum.UserToken]: state.userToken,
			}),
			merge: (persisted, current) => {
				const p = (persisted ?? {}) as Record<string, unknown>;
				return {
					...current,
					userInfo: (p[StorageEnum.UserInfo] as Partial<UserInfo>) ?? {},
					userToken: (p[StorageEnum.UserToken] as UserToken) ?? {},
				};
			},
		},
	),
);

export const useUserInfo = () => useUserStore((state) => state.userInfo);
export const useUserToken = () => useUserStore((state) => state.userToken);
export const useUserPermissions = () => useUserStore((state) => state.userInfo.permissions || []);
export const useUserActions = () => useUserStore((state) => state.actions);

/** Có mã quyền này không (dùng trong component). */
export const useCan = () => {
	const permissions = useUserPermissions();
	return (...codes: string[]) => codes.some((c) => permissions.includes(c));
};

export const signIn = async (data: SignInReq) => {
	const { user, access_token, refresh_token } = await authService.signin(data);
	// Web quản trị cần `dashboard.access` — tài khoản App (cán bộ trên xe) không có.
	if (!user.permissions.includes(P.DASHBOARD_ACCESS)) {
		await authService.logout(refresh_token).catch(() => undefined);
		throw new Error(t("sys.login.noWebAccess"));
	}
	const { setUserToken, setUserInfo } = useUserStore.getState().actions;
	setUserToken({ access_token, refresh_token });
	setUserInfo(user);
	return user;
};

export const signOut = async () => {
	const { userToken, actions } = useUserStore.getState();
	if (userToken.refresh_token) {
		await authService.logout(userToken.refresh_token).catch(() => undefined);
	}
	actions.clearUserInfoAndToken();
};

export default useUserStore;
