/**
 * Tra địa chỉ qua Esri World Geocoding — không cần API key khi chỉ hiển thị (không lưu kết
 * quả hàng loạt), địa chỉ tiếng Việt đầy đủ phường / quận. Cùng nhà cung cấp với nền bản đồ.
 * (Nominatim / tile.openstreetmap.org bị chặn trên mạng dev nên không dùng.)
 * Chỉ gọi khi người dùng thao tác (chọn điểm / gõ tìm).
 */
const BASE = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";

export interface GeoResult {
	lat: number;
	lng: number;
	label: string;
}

export async function reverseGeocode(lat: number, lng: number, lang = "vi"): Promise<string | null> {
	try {
		const res = await fetch(
			`${BASE}/reverseGeocode?f=json&location=${lng},${lat}&langCode=${lang === "vi" ? "VI" : "EN"}`,
		);
		if (!res.ok) return null;
		const data = await res.json();
		return data?.address?.Match_addr ?? data?.address?.LongLabel ?? null;
	} catch {
		return null;
	}
}

export async function searchAddress(q: string, lang = "vi"): Promise<GeoResult[]> {
	if (!q.trim()) return [];
	try {
		const res = await fetch(
			`${BASE}/findAddressCandidates?f=json&maxLocations=6&countryCode=VNM&langCode=${lang === "vi" ? "VI" : "EN"}&SingleLine=${encodeURIComponent(q)}`,
		);
		if (!res.ok) return [];
		const data: { candidates?: { address: string; location: { x: number; y: number } }[] } = await res.json();
		return (data.candidates ?? []).map((c) => ({ lat: c.location.y, lng: c.location.x, label: c.address }));
	} catch {
		return [];
	}
}
