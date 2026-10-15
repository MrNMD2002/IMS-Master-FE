import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import gpsService from "@/api/services/gpsService";
import { P } from "@/constants/permission";
import { useCan } from "@/store/userStore";
import { LIVE_REFRESH_MS } from "./use-live-vehicles";

export interface VehicleSignal {
	/** Có vị trí trong 60 giây gần nhất (cùng ngưỡng với bản đồ giám sát). */
	online: boolean;
	/** Bao lâu từ lần gửi vị trí cuối; null = xe chưa từng gửi vị trí. */
	secondsAgo: number | null;
}

/**
 * Tín hiệu GPS của các xe, theo id xe. Dùng chung nguồn `gps/latest-locations` với trang
 * Giám sát để trang Phương tiện không báo "Sẵn sàng" cho xe đã mất tín hiệu.
 * Thiếu quyền `gps.read` → `null` (không biết tín hiệu, giữ cách hiển thị cũ).
 */
export function useVehicleSignal(tenantId?: number) {
	const can = useCan();
	const canGps = can(P.GPS_READ);
	const gps = useQuery({
		queryKey: ["gps-latest", { tenant_id: tenantId }],
		queryFn: () => gpsService.latest({ tenant_id: tenantId }),
		refetchInterval: LIVE_REFRESH_MS,
		enabled: canGps,
	});
	return useMemo(() => {
		if (!canGps || !gps.data) return null;
		const map = new Map<number, VehicleSignal>();
		for (const g of gps.data.data ?? []) map.set(g.id, { online: g.is_active, secondsAgo: g.seconds_ago });
		return {
			get: (deviceId: number): VehicleSignal => map.get(deviceId) ?? { online: false, secondsAgo: null },
		};
	}, [canGps, gps.data]);
}
