import type { DispatchSuggestions, GeocodeItem } from "#/cmc";
import apiClient from "../apiClient";

/** Xe quanh hiện trường, xe tới nhanh nhất trước (thời gian đi đường thực tế qua OSRM). */
const dispatchSuggestions = (params: {
	latitude: number;
	longitude: number;
	radius_km?: number;
	tenant_id?: number;
	page_size?: number;
}) => apiClient.get<DispatchSuggestions>({ url: "/map/dispatch-suggestions", params: { page_size: 50, ...params } });

/** Tìm địa chỉ (Photon tự host, đơn vị hành chính mới; Hoàng Sa / Trường Sa ghi theo Việt Nam). */
const geocode = (params: { q: string; limit?: number; near_lat?: number; near_lng?: number }) =>
	apiClient.get<GeocodeItem[]>({ url: "/map/geocode", params, silent: true });

/** Địa chỉ của một toạ độ — null nếu không tìm thấy. */
const reverse = (lat: number, lng: number) =>
	apiClient.get<GeocodeItem | null>({ url: "/map/reverse", params: { lat, lng }, silent: true });

export default { dispatchSuggestions, geocode, reverse };
