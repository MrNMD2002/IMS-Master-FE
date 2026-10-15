import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Marker, Pane, Polygon, useMapEvents } from "react-leaflet";
import { ThemeMode } from "#/enum";
import { useSettings } from "@/store/settingStore";

/**
 * Lãnh thổ và chủ quyền biển đảo Việt Nam, vẽ ĐÈ lên mọi nền bản đồ.
 *
 * Nền bản đồ quốc tế (Esri...) để trống hoặc ghi tên khác cho Hoàng Sa / Trường Sa. Bản đồ
 * phát hành tại Việt Nam phải thể hiện hai quần đảo thuộc Việt Nam (Luật Đo đạc và bản đồ 2018),
 * nên lớp này luôn bật ở mọi bản đồ trong app — không phụ thuộc nhà cung cấp nền.
 *
 * Dữ liệu: public/geo/vietnam.json, dựng bằng scripts/build-vietnam-geo.py
 *  - Ranh giới: Natural Earth 1:10m bản "theo quan điểm Việt Nam" (gồm Hoàng Sa, Trường Sa).
 *  - Địa danh: Wikidata (nhãn tiếng Việt) — đảo, đá, bãi; đảo ven bờ; bán đảo, mũi đất.
 */

type PlaceKind = "island" | "reef" | "subgroup" | "coast-island" | "cape";
interface VietnamGeo {
	boundary: number[][][][]; // MultiPolygon [lng, lat]
	archipelagos: Record<"hoangSa" | "truongSa", number[][]>;
	places: { n: string; k: PlaceKind; z: number; p: [number, number] }[];
}

const GROUPS: { key: "eastSea" | "hoangSa" | "truongSa"; at: [number, number] }[] = [
	{ key: "eastSea", at: [13.4, 115.6] },
	{ key: "hoangSa", at: [17.45, 112.0] },
	{ key: "truongSa", at: [12.0, 114.4] },
];
/** Đất liền & đảo ven bờ: nền đã có nhãn khi phóng to gần — tắt nhãn của ta từ mức này. */
const COAST_MAX_ZOOM = 11;

const COLORS = {
	light: { border: "#C62828", fill: "#C62828", envelope: "#B71C1C" },
	dark: { border: "#FF6B6B", fill: "#FF6B6B", envelope: "#FF8A80" },
};

const toLatLng = (ring: number[][]) => ring.map(([lng, lat]) => [lat, lng] as [number, number]);

/** `text = null`: chỉ chấm vị trí (tên bị nhường chỗ cho địa danh ưu tiên hơn ở gần). */
const labelIcon = (text: string | null, kind: "group" | "sea" | PlaceKind) =>
	L.divIcon({
		className: `ims-sov ims-sov--${kind}`,
		html:
			kind === "group" || kind === "sea"
				? `<span>${text}</span>`
				: `<span class="ims-sov__dot"></span>${text ? `<span>${text}</span>` : ""}`,
		iconSize: [0, 0],
	});

/** Thứ tự ưu tiên đặt tên khi chật: nhóm đảo → đảo → đảo ven bờ → bán đảo / mũi → đá, bãi. */
const PRIORITY: Record<PlaceKind, number> = { subgroup: 0, island: 1, "coast-island": 2, cape: 3, reef: 4 };
const FONT_PX: Record<PlaceKind, number> = { subgroup: 12, island: 11, "coast-island": 11, cape: 11, reef: 10 };

export default function SovereigntyLayer() {
	const { t } = useTranslation();
	const { themeMode } = useSettings();
	const c = COLORS[themeMode === ThemeMode.Dark ? "dark" : "light"];
	const { data } = useQuery({
		queryKey: ["geo", "vietnam"],
		queryFn: async (): Promise<VietnamGeo> => (await fetch(`${import.meta.env.BASE_URL}geo/vietnam.json`)).json(),
		staleTime: Number.POSITIVE_INFINITY,
	});

	const [view, setView] = useState<{ zoom: number; bounds: L.LatLngBounds } | null>(null);
	const map = useMapEvents({
		moveend: () => setView({ zoom: map.getZoom(), bounds: map.getBounds().pad(0.2) }),
		zoomend: () => setView({ zoom: map.getZoom(), bounds: map.getBounds().pad(0.2) }),
	});
	const zoom = view?.zoom ?? map.getZoom();
	const bounds = view?.bounds ?? map.getBounds().pad(0.2);

	const polygons = useMemo(() => (data?.boundary ?? []).map((poly) => poly.map(toLatLng)), [data]);
	const envelopes = useMemo(() => Object.values(data?.archipelagos ?? {}).map((ring) => toLatLng(ring)), [data]);
	// Chỉ dựng nhãn trong khung nhìn & đúng mức phóng to — tránh hàng trăm phần tử DOM thừa.
	// Tránh chồng chữ: đặt tên theo ưu tiên, tên nào đè lên khung chữ đã đặt thì chỉ hiện chấm.
	const places = useMemo(() => {
		const visible = (data?.places ?? [])
			.filter(
				(p) =>
					zoom >= p.z && !((p.k === "coast-island" || p.k === "cape") && zoom > COAST_MAX_ZOOM) && bounds.contains(p.p),
			)
			.sort((a, b) => PRIORITY[a.k] - PRIORITY[b.k]);
		const taken: { x1: number; y1: number; x2: number; y2: number }[] = [];
		return visible.map((p) => {
			const pt = map.latLngToContainerPoint(p.p);
			const fs = FONT_PX[p.k];
			// Khung chữ ước lượng: chấm 11px + mỗi ký tự ~0.58 cỡ chữ, cao 1.4 cỡ chữ, chừa lề 3px.
			const box = {
				x1: pt.x - 6,
				y1: pt.y - fs * 0.7 - 3,
				x2: pt.x + 11 + p.n.length * fs * 0.58 + 3,
				y2: pt.y + fs * 0.7 + 3,
			};
			const hit = taken.some((b) => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1);
			if (!hit) taken.push(box);
			return { ...p, showName: !hit };
		});
	}, [data, zoom, bounds, map]);

	return (
		<>
			<Pane name="ims-sovereignty" style={{ zIndex: 350 }}>
				{polygons.map((poly, i) => (
					<Polygon
						key={i}
						positions={poly}
						interactive={false}
						pathOptions={{ color: c.border, weight: zoom >= 9 ? 2.5 : 1.6, fillColor: c.fill, fillOpacity: 0.04 }}
					/>
				))}
				{envelopes.map((ring, i) => (
					<Polygon
						key={`env-${i}`}
						positions={ring}
						interactive={false}
						pathOptions={{ color: c.envelope, weight: 1.5, dashArray: "8 6", fill: false }}
					/>
				))}
			</Pane>
			{GROUPS.map((g) => (
				<Marker
					key={g.key}
					position={g.at}
					interactive={false}
					keyboard={false}
					zIndexOffset={-1000}
					icon={labelIcon(t(`map.sovereignty.${g.key}`), g.key === "eastSea" ? "sea" : "group")}
				/>
			))}
			{places.map((p) => (
				<Marker
					key={`${p.n}-${p.p[0]}-${p.p[1]}-${p.showName ? 1 : 0}`}
					position={p.p}
					interactive={false}
					keyboard={false}
					zIndexOffset={-1000}
					icon={labelIcon(p.showName ? p.n : null, p.k)}
				/>
			))}
		</>
	);
}
