import type { Paged, PageQuery } from "#/api";
import type { UserCreateReq, UserInfo, UserQuery, UserUpdateReq } from "#/ims";
import apiClient from "../apiClient";

export interface GrantablePermission {
	code: string;
	name: string;
	module?: string | null;
}

const list = (params: PageQuery & UserQuery) => apiClient.get<Paged<UserInfo>>({ url: "/user/list", params });
const detail = (id: number) => apiClient.get<UserInfo>({ url: `/user/detail/${id}` });
const create = (data: UserCreateReq) => apiClient.post<UserInfo>({ url: "/user/create", data });
const update = (id: number, data: UserUpdateReq) => apiClient.post<UserInfo>({ url: `/user/update/${id}`, data });
const remove = (id: number) => apiClient.post({ url: `/user/delete/${id}` });
const resetPassword = (id: number, new_password: string) =>
	apiClient.post({ url: `/user/${id}/reset-password`, data: { new_password } });
const replacePermissions = (id: number, permission_codes: string[]) =>
	apiClient.post({ url: `/user/${id}/permissions/replace`, data: { permission_codes } });
const grantable = () =>
	apiClient.get<{ permissions: GrantablePermission[] }>({ url: "/user/grantable-permissions", silent: true });

export default { list, detail, create, update, remove, resetPassword, replacePermissions, grantable };
