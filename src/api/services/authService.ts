import type { LoginResult, UserInfo } from "#/cmc";
import apiClient from "../apiClient";

export interface SignInReq {
	username: string;
	password: string;
}

const signin = (data: SignInReq) => apiClient.post<LoginResult>({ url: "/login", data, silent: true });
const logout = (refresh_token: string) =>
	apiClient.post({ url: "/login/logout", data: { refresh_token }, silent: true });
const me = () => apiClient.get<UserInfo>({ url: "/user/me" });
const updateMe = (data: { full_name?: string; username?: string; avatar?: string | null }) =>
	apiClient.post<UserInfo>({ url: "/user/me/update", data });
const changePassword = (data: { old_password: string; new_password: string }) =>
	apiClient.post<UserInfo>({ url: "/user/me/change-password", data });

export default { signin, logout, me, updateMe, changePassword };
