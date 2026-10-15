import L from "leaflet";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Marker, useMapEvents } from "react-leaflet";

/**
 * Nhãn chủ quyền biển đảo Việt Nam, vẽ ĐÈ lên mọi nền bản đồ.
 *
 * Nền bản đồ quốc tế (Esri...) để trống hoặc ghi tên khác cho Hoàng Sa / Trường Sa. Bản đồ
 * phát hành tại Việt Nam phải thể hiện hai quần đảo này thuộc Việt Nam (Luật Đo đạc và bản
 * đồ 2018), nên lớp này luôn bật ở mọi bản đồ trong app — không phụ thuộc nhà cung cấp nền.
 * Toạ độ là vị trí đặt nhãn (gần đúng), không dùng để đo đạc.
 */
const GROUPS: { key: string; at: [number, number] }[] = [
	{ key: "eastSea", at: [13.4, 115.6] },
	{ key: "hoangSa", at: [16.45, 112.0] },
	{ key: "truongSa", at: [9.9, 114.6] },
];

/** Một số đảo tiêu biểu — chỉ hiện khi phóng to đủ gần (tránh rối khi xem cả nước). */
const ISLANDS: { name: string; at: [number, number] }[] = [
	{ name: "Đảo Phú Lâm", at: [16.834, 112.336] },
	{ name: "Đảo Hoàng Sa", at: [16.532, 111.608] },
	{ name: "Đảo Tri Tôn", at: [15.783, 111.2] },
	{ name: "Đảo Song Tử Tây", at: [11.43, 114.333] },
	{ name: "Đảo Ba Bình", at: [10.377, 114.365] },
	{ name: "Đảo Nam Yết", at: [10.181, 114.361] },
	{ name: "Đảo Sinh Tồn", at: [9.882, 114.329] },
	{ name: "Đảo Trường Sa Lớn", at: [8.645, 111.919] },
];
const ISLAND_MIN_ZOOM = 7;

const labelIcon = (text: string, kind: "group" | "sea" | "island") =>
	L.divIcon({
		className: `ims-sov ims-sov--${kind}`,
		html: kind === "island" ? `<span class="ims-sov__dot"></span><span>${text}</span>` : `<span>${text}</span>`,
		iconSize: [0, 0],
	});

export default function SovereigntyLayer() {
	const { t } = useTranslation();
	const [zoom, setZoom] = useState<number | null>(null);
	const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
	const z = zoom ?? map.getZoom();

	return (
		<>
			{GROUPS.map((g) => (
				<Marker
					key={g.key}
					position={g.at}
					interactive={false}
					keyboard={false}
					icon={labelIcon(t(`map.sovereignty.${g.key}`), g.key === "eastSea" ? "sea" : "group")}
				/>
			))}
			{z >= ISLAND_MIN_ZOOM &&
				ISLANDS.map((i) => (
					<Marker
						key={i.name}
						position={i.at}
						interactive={false}
						keyboard={false}
						icon={labelIcon(i.name, "island")}
					/>
				))}
		</>
	);
}
