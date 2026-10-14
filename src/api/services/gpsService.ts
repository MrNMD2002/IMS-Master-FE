import type { Paged, PageQuery } from "#/api";
import type { GpsHistory, GpsLatest, GpsNearby } from "#/ims";
import apiClient from "../apiClient";

/** Vị trí hiện tại của mọi xe trong phạm vi. */
const latest = (params: PageQuery & { tenant_id?: number; device_type?: number[]; search?: string } = {}) =>
	apiClient.get<Paged<GpsLatest>>({
		url: "/gps/latest-locations",
		params: { page_size: 1000, ...params },
		silent: true,
	});

/** Xe trong bán kính quanh một điểm, gần nhất trước. */
const nearby = (params: {
	latitude: number;
	longitude: number;
	radius_km?: number;
	tenant_id?: number;
	device_type?: number[];
	page_size?: number;
}) => apiClient.get<Paged<GpsNearby>>({ url: "/gps", params: { page_size: 50, ...params } });

/** Lịch sử di chuyển (tối đa 24h). */
const history = (params: { device_id: number; start: string; end: string; limit?: number }) =>
	apiClient.get<GpsHistory>({ url: "/gps/history", params });

export default { latest, nearby, history };
