import L from "leaflet";
import type { ComponentProps } from "react";
import { useEffect, useRef } from "react";
import { Marker } from "react-leaflet";

type MarkerProps = ComponentProps<typeof Marker>;

interface AnimatedMarkerProps extends Omit<MarkerProps, "position"> {
	/** Vị trí đích [lat, lng]. Khi đổi, marker trượt đều tới đó thay vì nhảy. */
	position: [number, number];
	/** Thời gian trượt một chặng (ms) — nên xấp xỉ chu kỳ làm mới vị trí. */
	duration?: number;
}

/**
 * Marker tự nội suy vị trí: mỗi khi `position` đổi, con trỏ trượt đều từ chỗ cũ sang chỗ mới bằng
 * requestAnimationFrame (gọi thẳng `setLatLng`, không re-render React từng khung), nên xe di chuyển
 * mượt thay vì nhảy cóc mỗi lần poll. Không đụng tới transform khi kéo/zoom bản đồ.
 */
export function AnimatedMarker({ position, duration = 5000, ...rest }: AnimatedMarkerProps) {
	const markerRef = useRef<L.Marker>(null);
	// Vị trí lúc mount — giữ cố định để react-leaflet không tự setLatLng (gây nhảy) ở các lần render sau.
	const initial = useRef<[number, number]>(position);
	const rafRef = useRef<number | undefined>(undefined);

	useEffect(() => {
		const marker = markerRef.current;
		if (!marker) return;
		const from = marker.getLatLng();
		const to = L.latLng(position[0], position[1]);
		if (from.equals(to)) return;

		const start = performance.now();
		if (rafRef.current) cancelAnimationFrame(rafRef.current);
		const step = (now: number) => {
			const t = Math.min(1, (now - start) / duration);
			marker.setLatLng([from.lat + (to.lat - from.lat) * t, from.lng + (to.lng - from.lng) * t]);
			if (t < 1) rafRef.current = requestAnimationFrame(step);
		};
		rafRef.current = requestAnimationFrame(step);

		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [position, duration]);

	return <Marker ref={markerRef} position={initial.current} {...rest} />;
}
