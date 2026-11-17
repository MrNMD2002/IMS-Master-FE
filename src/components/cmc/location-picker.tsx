import type { Map as LeafletMap } from "leaflet";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Marker, useMapEvents } from "react-leaflet";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { reverseGeocode } from "@/utils/geocode";
import BaseMap, { DEFAULT_CENTER } from "./map/base-map";
import MapControls from "./map/map-controls";
import { pickIcon } from "./map/markers";

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
	useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
	return null;
}

/**
 * Bản đồ nhỏ để chọn vị trí: bấm vào bản đồ hoặc kéo ghim. Ngay dưới bản đồ hiện vĩ độ, kinh độ
 * và địa chỉ đầy đủ của điểm đang chọn (tra ngược qua máy chủ bản đồ CMC).
 */
export default function LocationPicker({
	lat,
	lng,
	onChange,
	height = 240,
	extra,
}: {
	lat?: number | null;
	lng?: number | null;
	onChange: (lat: number, lng: number) => void;
	height?: number;
	/** Thêm vào hàng toạ độ (vd nút "Bỏ vị trí"). */
	extra?: ReactNode;
}) {
	const { t } = useTranslation();
	const mapRef = useRef<LeafletMap>(null);
	const has = lat !== null && lat !== undefined && lng !== null && lng !== undefined;
	const [address, setAddress] = useState<string | null>(null);
	const [finding, setFinding] = useState(false);

	// Khi vị trí đổi từ ngoài (tìm địa chỉ) → đưa bản đồ tới đó.
	useEffect(() => {
		if (has && mapRef.current)
			mapRef.current.setView([lat as number, lng as number], Math.max(mapRef.current.getZoom(), 15));
	}, [has, lat, lng]);

	// Tra địa chỉ của điểm đang chọn; kéo ghim liên tục chỉ tra điểm cuối, kết quả cũ bị bỏ.
	useEffect(() => {
		if (!has) {
			setAddress(null);
			setFinding(false);
			return;
		}
		let stale = false;
		setFinding(true);
		const timer = setTimeout(async () => {
			const a = await reverseGeocode(lat as number, lng as number);
			if (stale) return;
			setAddress(a);
			setFinding(false);
		}, 250);
		return () => {
			stale = true;
			clearTimeout(timer);
		};
	}, [has, lat, lng]);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(`${(lat as number).toFixed(6)}, ${(lng as number).toFixed(6)}`);
			toast.success(t("locationPicker.copied"));
		} catch {
			/* trình duyệt chặn clipboard (trang không HTTPS) — bỏ qua */
		}
	};

	return (
		<div className="flex flex-col gap-2">
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

			{has && (
				<div className="flex flex-col gap-1.5 rounded-lg border bg-muted/50 px-3 py-2 text-xs">
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<Icon icon="solar:map-point-bold" size={16} className="text-primary" />
						<span>
							<span className="text-text-secondary">{t("locationPicker.lat")}:</span>{" "}
							<span className="font-mono font-medium">{(lat as number).toFixed(6)}</span>
						</span>
						<span>
							<span className="text-text-secondary">{t("locationPicker.lng")}:</span>{" "}
							<span className="font-mono font-medium">{(lng as number).toFixed(6)}</span>
						</span>
						<button
							type="button"
							onClick={copy}
							title={t("locationPicker.copy")}
							className="text-text-secondary hover:text-primary"
						>
							<Icon icon="solar:copy-linear" size={14} />
						</button>
						{extra && <span className="ml-auto">{extra}</span>}
					</div>
					<div className="flex items-start gap-3">
						<Icon
							icon={finding ? "svg-spinners:180-ring" : "solar:streets-map-point-linear"}
							size={16}
							className="mt-px shrink-0 text-text-secondary"
						/>
						<span className={address && !finding ? "" : "text-text-secondary"}>
							{finding ? t("locationPicker.finding") : (address ?? t("locationPicker.noAddress"))}
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
