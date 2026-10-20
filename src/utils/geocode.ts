import mapService from "@/api/services/mapService";

/**
 * Tra địa chỉ qua API bản đồ CMC (Photon tự host trên dữ liệu OSM Việt Nam) — địa chỉ theo đơn vị
 * hành chính mới (phường / xã, tỉnh / thành), vùng Hoàng Sa / Trường Sa ghi theo Việt Nam.
 * Máy chủ tìm địa chỉ lỗi thì trả rỗng, người dùng tự gõ địa chỉ.
 */
export interface GeoResult {
	lat: number;
	lng: number;
	label: string;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
	try {
		return (await mapService.reverse(lat, lng))?.label ?? null;
	} catch {
		return null;
	}
}

export async function searchAddress(q: string): Promise<GeoResult[]> {
	if (!q.trim()) return [];
	try {
		const items = await mapService.geocode({ q: q.trim() });
		return items.map((i) => ({ lat: i.latitude, lng: i.longitude, label: i.label }));
	} catch {
		return [];
	}
}
