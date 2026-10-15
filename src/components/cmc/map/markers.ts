import L from "leaflet";
import type { IncidentStatus } from "#/cmc";
import { INCIDENT_STATUS_COLOR } from "../status";

/** `unavailable`: xe ngừng hoạt động / bảo trì / mất, hoặc loại phương tiện bị khoá — không điều được. */
export type VehicleState = "ready" | "mobilized" | "unavailable" | "offline";

export const VEHICLE_COLOR: Record<VehicleState, string> = {
	ready: "#22C55E",
	mobilized: "#FF7A00",
	unavailable: "#B71D18",
	offline: "#919EAB",
};

const CAR_SVG =
	'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11h.5A1.5 1.5 0 0 1 21 12.5V17a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H4a1 1 0 0 1-1-1v-4.5A1.5 1.5 0 0 1 4.5 11H5zm2.1 0h9.8l-1.2-3.6a.6.6 0 0 0-.6-.4H8.9a.6.6 0 0 0-.6.4L7.1 11z"/></svg>';

const SIREN_SVG =
	'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4a6 6 0 0 0-6 6v6h12v-6a6 6 0 0 0-6-6zm-1 3.2a.8.8 0 0 1 .3 1.6A2 2 0 0 0 9.8 10.6a.8.8 0 0 1-1.6-.2A3.6 3.6 0 0 1 11 7.2zM4 18h16a1 1 0 0 1 1 1v1H3v-1a1 1 0 0 1 1-1zM11 1h2v2h-2zM2.5 6.2l1.4-1.4 1.5 1.4L4 7.6zm16.1-.1L20 4.8l1.4 1.4-1.4 1.4z"/></svg>';

const escapeHtml = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export function vehicleIcon(state: VehicleState, label?: string | null, selected = false) {
	const color = VEHICLE_COLOR[state];
	const pulse = state === "mobilized" ? `<span class="cmc-vehicle__pulse" style="color:${color}"></span>` : "";
	const text = label ? `<span class="cmc-vehicle__label">${escapeHtml(label)}</span>` : "";
	return L.divIcon({
		className: `cmc-vehicle${selected ? " cmc-vehicle--selected" : ""}`,
		html: `<div class="cmc-vehicle__body" style="background:${color}">${pulse}${CAR_SVG}</div>${text}`,
		iconSize: [34, 34],
		iconAnchor: [17, 17],
		popupAnchor: [0, -18],
	});
}

export function incidentIcon(status: IncidentStatus, active = false) {
	const color = INCIDENT_STATUS_COLOR[status] ?? "#FF5630";
	return L.divIcon({
		className: `cmc-incident${active ? " cmc-incident--active" : ""}`,
		html: `<div class="cmc-incident__pin" style="background:${color};color:${color}">${SIREN_SVG}</div>`,
		iconSize: [36, 36],
		iconAnchor: [18, 40],
		popupAnchor: [0, -38],
	});
}

/** Điểm chọn trên bản đồ (khi tạo sự vụ). */
export function pickIcon() {
	return incidentIcon("PROCESSING", true);
}

const HQ_SVG =
	'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 2 8v2h20V8L12 3zM4 11v7H3v3h18v-3h-1v-7h-3v7h-2v-7h-2v7h-2v-7H8v7H6v-7H4z"/></svg>';

/** Trụ sở tổ chức / đơn vị. */
export function hqIcon(label?: string | null) {
	const text = label ? `<span class="cmc-hq__label">${escapeHtml(label)}</span>` : "";
	return L.divIcon({
		className: "cmc-hq",
		html: `<div class="cmc-hq__body">${HQ_SVG}</div>${text}`,
		iconSize: [30, 30],
		iconAnchor: [15, 15],
		popupAnchor: [0, -16],
	});
}

/** Tâm vòng lọc bán kính (kéo được). */
export function radiusCenterIcon() {
	return L.divIcon({
		className: "cmc-radius-center",
		html: '<div class="cmc-radius-center__dot"></div>',
		iconSize: [18, 18],
		iconAnchor: [9, 9],
	});
}
