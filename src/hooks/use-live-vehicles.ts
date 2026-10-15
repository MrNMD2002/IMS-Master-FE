import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Device, GpsLatest } from "#/cmc";
import deviceService from "@/api/services/deviceService";
import gpsService from "@/api/services/gpsService";
import type { VehicleState } from "@/components/cmc/map/markers";
import { P } from "@/constants/permission";
import { useCan } from "@/store/userStore";

export interface LiveVehicle extends GpsLatest {
	device?: Device;
	state: VehicleState;
}

/** Chu kỳ làm mới vị trí xe trên bản đồ. */
export const LIVE_REFRESH_MS = 10_000;

/**
 * Vị trí xe hiện tại (gps_latest) ghép với thông tin xe (đang điều động hay không).
 * Thiếu quyền `device.read` thì vẫn chạy, chỉ không biết trạng thái điều động.
 */
export function useLiveVehicles(params: { tenant_id?: number; device_type?: number[] } = {}, enabled = true) {
	const can = useCan();
	const canGps = can(P.GPS_READ);
	const canDevice = can(P.DEVICE_READ);

	const gps = useQuery({
		queryKey: ["gps-latest", params],
		queryFn: () => gpsService.latest(params),
		refetchInterval: LIVE_REFRESH_MS,
		enabled: enabled && canGps,
	});

	const devices = useQuery({
		queryKey: ["device-all", params.tenant_id],
		queryFn: () => deviceService.list({ page_size: 1000, tenant_id: params.tenant_id }),
		refetchInterval: LIVE_REFRESH_MS * 3,
		enabled: enabled && canDevice,
	});

	const vehicles = useMemo<LiveVehicle[]>(() => {
		const byId = new Map((devices.data?.data ?? []).map((d) => [d.id, d]));
		return (gps.data?.data ?? []).map((g) => {
			const device = byId.get(g.id);
			// Xe đang làm nhiệm vụ vẫn hiện "đang làm nhiệm vụ" dù loại vừa bị khoá (không bị rút).
			const state: VehicleState = device?.is_mobilized
				? "mobilized"
				: device?.available === false
					? "unavailable"
					: g.is_active
						? "ready"
						: "offline";
			return { ...g, device, state };
		});
	}, [gps.data, devices.data]);

	return {
		vehicles,
		devices: devices.data?.data ?? [],
		isLoading: gps.isLoading,
		dataUpdatedAt: gps.dataUpdatedAt,
		refetch: () => Promise.all([gps.refetch(), devices.refetch()]),
	};
}
