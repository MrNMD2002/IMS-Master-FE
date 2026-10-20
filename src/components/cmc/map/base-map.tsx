import type { LatLngExpression, Map as LeafletMap } from "leaflet";
import { type ReactNode, type Ref, useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { ThemeMode } from "#/enum";
import { useSettings } from "@/store/settingStore";
import { cn } from "@/utils";
import "./map.css";

/** Trung tâm mặc định: Hà Nội. */
export const DEFAULT_CENTER: [number, number] = [21.0285, 105.8542];

/**
 * Nền bản đồ CMC tự host (repo backend: docker-compose.map.yml) — đã vẽ sẵn chủ quyền biển đảo
 * và viền lãnh thổ Việt Nam. `VITE_MAP_TILE_URL` bỏ trống → máy chủ ảnh nền cùng máy với Web,
 * cổng 8090. `{r}` = "@2x" trên màn hình nét; `?v=` tăng mỗi khi backend đổi kiểu bản đồ để
 * trình duyệt bỏ ảnh cũ đã lưu tạm (xem docs/map/MAP_SERVER.md ở repo backend).
 */
const MAP_STYLE_VERSION = 3;
const TILE_URL =
	import.meta.env.VITE_MAP_TILE_URL ||
	`${window.location.protocol}//${window.location.hostname}:8090/styles/cmc/{z}/{x}/{y}{r}.png?v=${MAP_STYLE_VERSION}`;
const ATTRIBUTION =
	'&copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
/**
 * Nền chỉ có dữ liệu trong khung dựng (backend scripts/map/build-map-data.sh, BOUNDS) — ngoài
 * khung là ô trống (biển thành màu đất). Không cho thu nhỏ / kéo ra ngoài khung đó.
 */
const MIN_ZOOM = 5;
const MAX_BOUNDS: [[number, number], [number, number]] = [
	[-12, 78],
	[40, 142],
];

/** Leaflet cần gọi invalidateSize khi khung đổi kích thước (đóng / mở menu, panel). */
function AutoResize() {
	const map = useMap();
	useEffect(() => {
		const el = map.getContainer();
		const ro = new ResizeObserver(() => map.invalidateSize());
		ro.observe(el);
		return () => ro.disconnect();
	}, [map]);
	return null;
}

interface Props {
	center?: LatLngExpression;
	zoom?: number;
	className?: string;
	children?: ReactNode;
	mapRef?: Ref<LeafletMap>;
	scrollWheelZoom?: boolean;
}

/** Bản đồ nền CMC — giao diện tối thì làm tối ảnh nền bằng CSS. */
export default function BaseMap({
	center = DEFAULT_CENTER,
	zoom = 13,
	className,
	children,
	mapRef,
	scrollWheelZoom = true,
}: Props) {
	const { themeMode } = useSettings();
	const dark = themeMode === ThemeMode.Dark;
	return (
		<MapContainer
			ref={mapRef}
			center={center}
			zoom={zoom}
			scrollWheelZoom={scrollWheelZoom}
			className={cn("cmc-map h-full w-full", className)}
			zoomControl={false}
			minZoom={MIN_ZOOM}
			maxBounds={MAX_BOUNDS}
			maxBoundsViscosity={1}
		>
			<TileLayer
				url={TILE_URL}
				attribution={ATTRIBUTION}
				maxNativeZoom={19}
				maxZoom={19}
				className={dark ? "cmc-tiles-dim" : undefined}
			/>
			<AutoResize />
			{children}
		</MapContainer>
	);
}
