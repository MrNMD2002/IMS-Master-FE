import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Marker, Popup } from "react-leaflet";
import type { Camera, CameraStationLink } from "#/camera";
import cameraService from "@/api/services/cameraService";
import { Icon } from "@/components/icon";
import { P } from "@/constants/permission";
import { LiveViewModal } from "@/pages/ai-station/components/live-view";
import { useCan } from "@/store/userStore";
import { Button } from "@/ui/button";
import { CAMERA_COLOR, type CameraMapState, cameraIcon } from "./markers";

/** Trạng thái tốt nhất của camera trên các trạm đang chạy nó. */
function cameraState(c: Camera): CameraMapState {
	const states = c.stations.map((l) => l.state);
	if (states.includes("live")) return "live";
	if (states.includes("connecting")) return "connecting";
	if (states.includes("error")) return "error";
	return "off";
}

/** Trạm xem trực tiếp được: đang kết nối và đã có mã camera phía trạm. */
const liveLink = (c: Camera): CameraStationLink | undefined =>
	c.stations.find((l) => l.station_online && l.remote_id != null && l.state === "live") ??
	c.stations.find((l) => l.station_online && l.remote_id != null);

/** Danh sách camera đã đặt vị trí (theo tổ chức đang lọc) — dùng chung cho bản đồ và nút "về giữa". */
export function useMapCameras(tenantId: number | undefined, enabled: boolean) {
	const q = useQuery({
		queryKey: ["camera", "map", tenantId],
		queryFn: () => cameraService.list({ page: 1, page_size: 200, tenant_id: tenantId }),
		enabled,
		refetchInterval: 30_000,
	});
	return useMemo(() => (q.data?.data ?? []).filter((c) => c.latitude != null && c.longitude != null), [q.data]);
}

/**
 * Ghim camera trên bản đồ (đặt bên trong `BaseMap`). Bấm ghim → tên, vị trí, trạm đang chạy và nút
 * xem trực tiếp (qua trạm, hoặc máy chủ CMC tự kéo RTSP khi camera chưa gán trạm).
 */
export default function CameraMarkers({ cameras }: { cameras: Camera[] }) {
	const { t } = useTranslation();
	const [live, setLive] = useState<{ camera: Camera; link: CameraStationLink | null } | null>(null);
	const canLive = useCan()(P.CAMERA_LIVE_VIEW);

	return (
		<>
			{cameras.map((c) => {
				const link = liveLink(c);
				const direct = !link && /^rtsps?:\/\//i.test(c.source);
				const state = cameraState(c);
				const color = CAMERA_COLOR[state];
				return (
					<Marker
						key={`c${c.id}`}
						position={[c.latitude as number, c.longitude as number]}
						icon={cameraIcon(state, c.name)}
					>
						<Popup>
							<div className="flex w-60 flex-col gap-2">
								<div className="flex items-start gap-2.5">
									<span
										className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white"
										style={{ background: color }}
									>
										<Icon icon="solar:videocamera-record-bold" size={20} />
									</span>
									<div className="min-w-0 flex-1">
										<p className="truncate font-semibold leading-tight">{c.name}</p>
										<span className="mt-1 inline-flex items-center gap-1 text-xs font-medium" style={{ color }}>
											<span className="size-1.5 rounded-full" style={{ background: color }} />
											{t(`aiStation.camState.${state}`)}
										</span>
									</div>
								</div>
								{c.location && (
									<p className="flex items-start gap-1.5 text-xs text-text-secondary">
										<Icon icon="solar:map-point-linear" size={14} className="mt-px shrink-0" />
										<span>{c.location}</span>
									</p>
								)}
								<p className="flex items-start gap-1.5 text-xs text-text-secondary">
									<Icon icon="solar:cpu-bolt-linear" size={14} className="mt-px shrink-0" />
									<span>
										{c.stations.length > 0
											? c.stations.map((l) => l.station_name ?? l.station_id).join(", ")
											: direct
												? t("aiCamera.liveViaServer")
												: t("aiCamera.liveNeedsStation")}
									</span>
								</p>
								{canLive && (link || direct) && (
									<Button size="sm" className="w-full" onClick={() => setLive({ camera: c, link: link ?? null })}>
										<Icon icon="solar:play-circle-bold" size={16} />
										{t("aiStation.live.open")}
									</Button>
								)}
							</div>
						</Popup>
					</Marker>
				);
			})}
			{live && (
				<LiveViewModal
					station={live.link ? { id: live.link.station_id } : null}
					camera={{ id: live.link ? (live.link.remote_id ?? 0) : live.camera.id, name: live.camera.name }}
					open
					onClose={() => setLive(null)}
				/>
			)}
		</>
	);
}
