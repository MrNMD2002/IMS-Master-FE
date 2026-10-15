import type { Map as LeafletMap } from "leaflet";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Marker, useMapEvents } from "react-leaflet";
import BaseMap, { DEFAULT_CENTER } from "./map/base-map";
import MapControls from "./map/map-controls";
import { pickIcon } from "./map/markers";

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
	useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
	return null;
}

/** Bản đồ nhỏ để chọn vị trí: bấm vào bản đồ hoặc kéo ghim. */
export default function LocationPicker({
	lat,
	lng,
	onChange,
	height = 240,
}: {
	lat?: number | null;
	lng?: number | null;
	onChange: (lat: number, lng: number) => void;
	height?: number;
}) {
	const { t } = useTranslation();
	const mapRef = useRef<LeafletMap>(null);
	const has = lat !== null && lat !== undefined && lng !== null && lng !== undefined;

	// Khi vị trí đổi từ ngoài (tìm địa chỉ) → đưa bản đồ tới đó.
	useEffect(() => {
		if (has && mapRef.current)
			mapRef.current.setView([lat as number, lng as number], Math.max(mapRef.current.getZoom(), 15));
	}, [has, lat, lng]);

	return (
		<div className="relative overflow-hidden rounded-xl border" style={{ height }}>
			<BaseMap mapRef={mapRef} center={has ? [lat as number, lng as number] : DEFAULT_CENTER} zoom={has ? 15 : 12}>
				<ClickToPick onPick={onChange} />
				{has && (
					<Marker
						position={[lat as number, lng as number]}
						icon={pickIcon()}
						draggable
						eventHandlers={{
							dragend: (e) => {
								const p = e.target.getLatLng();
								onChange(p.lat, p.lng);
							},
						}}
					/>
				)}
				<MapControls className="right-2 bottom-2" />
			</BaseMap>
			{!has && (
				<div className="pointer-events-none absolute inset-x-0 top-2 z-[500] mx-auto w-fit rounded-full bg-background/90 px-3 py-1 text-xs shadow">
					{t("incident.form.clickMapHint")}
				</div>
			)}
		</div>
	);
}
