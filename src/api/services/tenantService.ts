import type { Paged, PageQuery } from "#/api";
import type { Tenant, TenantOption, TenantReq } from "#/ims";
import apiClient from "../apiClient";

const list = (params: PageQuery & { search?: string; is_active?: boolean; parent_tenant_id?: number }) =>
	apiClient.get<Paged<Tenant>>({ url: "/tenant/list", params });
const options = () => apiClient.get<TenantOption[]>({ url: "/tenant/options" });
const mine = () => apiClient.get<Tenant>({ url: "/tenant/me" });
const updateMine = (data: TenantReq) => apiClient.post<Tenant>({ url: "/tenant/me/update", data });
const detail = (id: number) => apiClient.get<Tenant>({ url: `/tenant/detail/${id}` });
const create = (data: TenantReq) => apiClient.post<Tenant>({ url: "/tenant/create", data });
const update = (id: number, data: TenantReq) => apiClient.post<Tenant>({ url: `/tenant/update/${id}`, data });
const remove = (id: number) => apiClient.post({ url: `/tenant/delete/${id}` });

export default { list, options, mine, updateMine, detail, create, update, remove };
