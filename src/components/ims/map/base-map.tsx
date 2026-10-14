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
 * Nền bản đồ Esri — không cần API key. (tile.openstreetmap.org bị chặn trên mạng dev,
 * CARTO giờ đòi key.) Có tile server riêng thì đổi URL ở đây: docs/map/OSM_TILE_SERVER.md.
 */
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const ESRI_ATTR = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>';
const TILES = {
	light: { url: `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`, attribution: ESRI_ATTR, maxNativeZoom: 19 },
	dark: {
		url: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
		attribution: ESRI_ATTR,
		maxNativeZoom: 16,
	},
};

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

/** Bản đồ nền — tự đổi lớp nền sáng / tối theo giao diện. */
export default function BaseMap({
	center = DEFAULT_CENTER,
	zoom = 13,
	className,
	children,
	mapRef,
	scrollWheelZoom = true,
}: Props) {
	const { themeMode } = useSettings();
	const tile = themeMode === ThemeMode.Dark ? TILES.dark : TILES.light;
	return (
		<MapContainer
			ref={mapRef}
			center={center}
			zoom={zoom}
			scrollWheelZoom={scrollWheelZoom}
			className={cn("ims-map h-full w-full", className)}
			zoomControl={false}
		>
			<TileLayer
				key={tile.url}
				url={tile.url}
				attribution={tile.attribution}
				maxNativeZoom={tile.maxNativeZoom}
				maxZoom={19}
			/>
			<AutoResize />
			{children}
		</MapContainer>
	);
}
