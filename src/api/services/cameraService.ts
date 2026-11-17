import type { Paged } from "#/api";
import type { Camera, CameraChange, CameraInput, CameraPushResult, CameraQuery, PluginBindingInput } from "#/camera";
import apiClient from "../apiClient";

/** Lệnh xuống trạm chờ trạm trả lời — cho thời gian như lệnh trạm. */
const PUSH_TIMEOUT = 30_000;

const cameraService = {
	list: (params: CameraQuery) => apiClient.get<Paged<Camera>>({ url: "/cameras", params }),
	get: (id: number) => apiClient.get<Camera>({ url: `/cameras/${id}` }),
	create: (data: CameraInput) => apiClient.post<Camera>({ url: "/cameras", data }),
	update: (id: number, data: Partial<CameraInput>) =>
		apiClient.request<CameraChange>({ url: `/cameras/${id}`, method: "PATCH", data, timeout: PUSH_TIMEOUT }),
	remove: (id: number) =>
		apiClient.request<CameraPushResult[]>({ url: `/cameras/${id}`, method: "DELETE", timeout: PUSH_TIMEOUT }),
	assign: (id: number, data: { station_id: string; enabled?: boolean; plugins?: PluginBindingInput[] }) =>
		apiClient.post<CameraChange>({ url: `/cameras/${id}/stations`, data, timeout: PUSH_TIMEOUT }),
	unassign: (id: number, stationId: string) =>
		apiClient.request<CameraChange>({
			url: `/cameras/${id}/stations/${stationId}`,
			method: "DELETE",
			timeout: PUSH_TIMEOUT,
		}),
};

export default cameraService;
