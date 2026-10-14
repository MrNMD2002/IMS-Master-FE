import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

/** Khung bản đồ vừa đủ thấy mọi điểm. Chỉ chạy lại khi TẬP điểm đổi (theo `fitKey` nếu có). */
export default function FitBounds({
	points,
	fitKey,
	maxZoom = 16,
}: {
	points: [number, number][];
	fitKey?: string;
	maxZoom?: number;
}) {
	const map = useMap();
	const key = fitKey ?? points.map((p) => p.join(",")).join("|");
	// biome-ignore lint/correctness/useExhaustiveDependencies: chỉ fit lại khi tập điểm đổi
	useEffect(() => {
		if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom });
		else if (points.length === 1) map.setView(points[0], Math.min(15, maxZoom));
	}, [key]);
	return null;
}
