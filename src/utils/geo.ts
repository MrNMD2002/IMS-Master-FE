/** Khoảng cách đường chim bay giữa hai toạ độ (km) — công thức haversine. */
export function distanceKm(a: [number, number], b: [number, number]): number {
	const rad = Math.PI / 180;
	const dLat = (b[0] - a[0]) * rad;
	const dLng = (b[1] - a[1]) * rad;
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
	return 12_742 * Math.asin(Math.sqrt(h));
}

/** Toạ độ của một bản ghi có latitude/longitude dạng chuỗi số (API trả Decimal) — null nếu thiếu. */
export function toLatLng(v?: { latitude?: string | number | null; longitude?: string | number | null } | null) {
	const lat = v?.latitude;
	const lng = v?.longitude;
	if (lat === null || lat === undefined || lat === "" || lng === null || lng === undefined || lng === "") return null;
	const p: [number, number] = [Number(lat), Number(lng)];
	return Number.isFinite(p[0]) && Number.isFinite(p[1]) ? p : null;
}
