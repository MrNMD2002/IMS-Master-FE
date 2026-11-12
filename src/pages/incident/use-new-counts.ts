import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { INCIDENT_STATUSES, type IncidentStatus } from "#/cmc";
import incidentService from "@/api/services/incidentService";
import { useUserInfo } from "@/store/userStore";

/**
 * Số sự vụ MỚI trên từng tab trạng thái — "mới" = vào trạng thái đó sau lần cuối người dùng mở tab.
 *
 * - Mốc "đã xem" lưu theo người dùng ở localStorage, dùng giờ MÁY CHỦ (server_time) nên đồng hồ
 *   máy người dùng lệch cũng không đếm sai.
 * - Lần đầu (chưa có mốc) → lấy giờ máy chủ làm mốc: không bật badge cho cả lịch sử cũ.
 * - Đang mở tab nào thì mốc tab đó đi theo mỗi lần hỏi → badge tab đang xem luôn 0.
 */
type Seen = Partial<Record<IncidentStatus, string>>;

const POLL_MS = 15_000;
const storageKey = (userId?: number) => `cmc:incident-seen:${userId ?? "anon"}`;

function readSeen(key: string): Seen {
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as Seen) : {};
	} catch {
		return {};
	}
}

function writeSeen(key: string, seen: Seen) {
	try {
		localStorage.setItem(key, JSON.stringify(seen));
	} catch {
		/* chế độ riêng tư / bị chặn — badge vẫn chạy trong phiên */
	}
}

export function useIncidentNewCounts(activeStatus: string, tenantId?: number) {
	const { id: userId } = useUserInfo();
	const key = storageKey(userId);
	// Ref để queryFn luôn đọc mốc mới nhất mà không đổi queryKey (tránh vòng hỏi lại liên tục).
	const seenRef = useRef<Seen>(readSeen(key));
	const lastServerTime = useRef<string | undefined>(undefined);
	const [counts, setCounts] = useState<Partial<Record<IncidentStatus, number>>>({});

	useEffect(() => {
		seenRef.current = readSeen(key);
	}, [key]);

	const markSeen = useCallback(
		(status: IncidentStatus, at: string) => {
			seenRef.current = { ...seenRef.current, [status]: at };
			writeSeen(key, seenRef.current);
		},
		[key],
	);

	const { data } = useQuery({
		queryKey: ["incident", "status-summary", tenantId, userId],
		queryFn: () => {
			const s = seenRef.current;
			return incidentService.statusSummary({
				since_processing: s.PROCESSING,
				since_pending_approval: s.PENDING_APPROVAL,
				since_completed: s.COMPLETED,
				tenant_id: tenantId,
			});
		},
		enabled: userId != null,
		refetchInterval: POLL_MS,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: true,
	});

	useEffect(() => {
		if (!data) return;
		lastServerTime.current = data.server_time;
		const next: Partial<Record<IncidentStatus, number>> = {};
		for (const s of INCIDENT_STATUSES) {
			if (!seenRef.current[s] || s === activeStatus) {
				markSeen(s, data.server_time);
				next[s] = 0;
			} else {
				next[s] = data[s]?.new ?? 0;
			}
		}
		setCounts(next);
	}, [data, activeStatus, markSeen]);

	// Bấm sang tab → xoá badge tab đó ngay, không chờ lần hỏi kế tiếp.
	useEffect(() => {
		const s = activeStatus as IncidentStatus;
		if (!INCIDENT_STATUSES.includes(s) || !lastServerTime.current) return;
		markSeen(s, lastServerTime.current);
		setCounts((c) => (c[s] ? { ...c, [s]: 0 } : c));
	}, [activeStatus, markSeen]);

	return counts;
}
