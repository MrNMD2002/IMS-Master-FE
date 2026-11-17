/**
 * API Trạm AI (Vigil) — hợp đồng `Vigil-Master/docs/cmc-contract.md` mục 4.
 *
 * `GLOBAL_CONFIG.vigilMock` (biến `VITE_AI_STATION_MOCK=true`, mặc định tắt) chọn dữ liệu giả trong
 * trình duyệt thay cho CMC API. Trang chỉ gọi qua đây nên bỏ mock không phải sửa trang.
 */
import type { AxiosResponse } from "axios";
import type { Paged, PageQuery } from "#/api";
import type {
	AiCommand,
	AiCommandName,
	AiEvent,
	AiEventPage,
	AiEventQuery,
	AiEventStats,
	AiStation,
	AiStationCreateReq,
	AiStationDetail,
	AiStationUpdateReq,
	AiStationWithToken,
} from "#/vigil";
import { GLOBAL_CONFIG } from "@/global-config";
import apiClient from "../apiClient";
import { vigilMock } from "../mock/vigil-mock";

type StationQuery = PageQuery & { search?: string; tenant_id?: number };
/** API trả trạm kèm `pairing_token` ở cùng cấp → tách ra cho trang. */
type StationTokenRes = AiStation & { pairing_token: string };
const splitToken = ({ pairing_token, ...station }: StationTokenRes): AiStationWithToken => ({
	station,
	pairing_token,
});

const real = {
	listStations: (params: StationQuery) => apiClient.get<Paged<AiStation>>({ url: "/ai-stations", params }),
	getStation: (id: string) => apiClient.get<AiStationDetail>({ url: `/ai-stations/${id}` }),
	createStation: (data: AiStationCreateReq) =>
		apiClient.post<StationTokenRes>({ url: "/ai-stations", data }).then(splitToken),
	updateStation: (id: string, data: AiStationUpdateReq) =>
		apiClient.request<AiStation>({ url: `/ai-stations/${id}`, method: "PATCH", data }),
	rotateToken: (id: string) =>
		apiClient.post<StationTokenRes>({ url: `/ai-stations/${id}/rotate-token` }).then(splitToken),
	deleteStation: (id: string) => apiClient.request<void>({ url: `/ai-stations/${id}`, method: "DELETE" }),
	/** Gửi lệnh và chờ trạm trả lời (tối đa ~20 s); lỗi 409 = trạm mất kết nối. */
	sendCommand: (id: string, data: { cmd: AiCommandName; camera_id?: number; args?: Record<string, unknown> }) =>
		apiClient.post<AiCommand>({ url: `/ai-stations/${id}/commands`, data, timeout: 30_000 }),
	/** Vé xem trực tiếp camera (dùng 1 lần, 60 s) → mở WebSocket `ws_path?ticket=…`. */
	liveTicket: (id: string, cameraId: number) =>
		apiClient.post<{ ticket: string; ws_path: string }>({ url: `/ai-stations/${id}/cameras/${cameraId}/live` }),
	listCommands: (id: string) => apiClient.get<AiCommand[]>({ url: `/ai-stations/${id}/commands` }),
	listEvents: (params: AiEventQuery) => apiClient.get<AiEventPage>({ url: "/ai-events", params }),
	getEvent: (eventId: string) => apiClient.get<AiEvent>({ url: `/ai-events/${eventId}` }),
	eventStats: (params: Omit<AiEventQuery, "page" | "page_size">) =>
		apiClient.get<AiEventStats>({ url: "/ai-events/stats", params }),
};

const aiStationService: typeof real = GLOBAL_CONFIG.vigilMock ? vigilMock : real;

/**
 * Ảnh bằng chứng → URL hiển thị được. API trả `image_url` là đường dẫn tương đối
 * (`/ai-events/{id}/image?kind=frame`) có kiểm quyền: thẻ `<img>` không gửi được header nên phải
 * tải kèm token rồi `URL.createObjectURL` (giống ảnh hiện trường sự vụ). Người gọi tự
 * `URL.revokeObjectURL` khi xong. Ảnh của dữ liệu giả (`data:` / `http`) dùng thẳng.
 */
export const eventImageUrl = async (src: string): Promise<{ url: string; blob: boolean }> => {
	if (!src.startsWith("/")) return { url: src, blob: false };
	const res = await apiClient.get<AxiosResponse<Blob>>({ url: src, responseType: "blob", raw: true, silent: true });
	return { url: URL.createObjectURL(res.data), blob: true };
};

export const isVigilMock = GLOBAL_CONFIG.vigilMock;
export default aiStationService;
