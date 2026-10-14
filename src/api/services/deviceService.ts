import type { Paged, PageQuery } from "#/api";
import type { Device, DeviceQuery, DeviceReq, DeviceType, DeviceTypeReq, DeviceUser } from "#/ims";
import apiClient from "../apiClient";

const list = (params: PageQuery & DeviceQuery) => apiClient.get<Paged<Device>>({ url: "/device/list", params });
const detail = (id: number) => apiClient.get<Device>({ url: `/device/detail/${id}` });
const create = (data: DeviceReq) => apiClient.post<Device>({ url: "/device/create", data });
const update = (id: number, data: DeviceReq) => apiClient.post<Device>({ url: `/device/update/${id}`, data });
const remove = (id: number) => apiClient.post({ url: `/device/delete/${id}` });
const users = (id: number) => apiClient.get<DeviceUser[]>({ url: `/device/${id}/users` });
const assignUser = (id: number, user_id: number) =>
	apiClient.post<Device>({ url: `/device/${id}/users/assign`, data: { user_id } });
const removeUser = (id: number, user_id: number) =>
	apiClient.post<Device>({ url: `/device/${id}/users/remove`, data: { user_id } });
const rotateKey = (id: number) => apiClient.post<Device>({ url: `/device/${id}/mqtt/rotate-key` });

const typeList = (params: PageQuery & { search?: string; is_active?: boolean } = {}) =>
	apiClient.get<Paged<DeviceType>>({ url: "/device-type/list", params: { page_size: 1000, ...params } });
const typeCreate = (data: DeviceTypeReq) => apiClient.post<DeviceType>({ url: "/device-type/create", data });
const typeUpdate = (id: number, data: DeviceTypeReq) =>
	apiClient.post<DeviceType>({ url: `/device-type/update/${id}`, data });
const typeRemove = (id: number) => apiClient.post({ url: `/device-type/delete/${id}` });

export default {
	list,
	detail,
	create,
	update,
	remove,
	users,
	assignUser,
	removeUser,
	rotateKey,
	typeList,
	typeCreate,
	typeUpdate,
	typeRemove,
};
