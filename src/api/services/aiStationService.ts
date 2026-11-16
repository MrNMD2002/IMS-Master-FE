/**
 * API Trạm AI (Vigil) — hợp đồng `Vigil-Master/docs/cmc-contract.md` mục 4.
 *
 * `GLOBAL_CONFIG.vigilMock` (biến `VITE_AI_STATION_MOCK`, mặc định bật) chọn dữ liệu giả trong
 * trình duyệt thay cho CMC API. Trang chỉ gọi qua đây nên bỏ mock không phải sửa trang.
 */
import type { Paged, PageQuery } from "#/api";
import type {
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
	listEvents: (params: AiEventQuery) => apiClient.get<AiEventPage>({ url: "/ai-events", params }),
	getEvent: (eventId: string) => apiClient.get<AiEvent>({ url: `/ai-events/${eventId}` }),
	eventStats: (params: Omit<AiEventQuery, "page" | "page_size">) =>
		apiClient.get<AiEventStats>({ url: "/ai-events/stats", params }),
};

const aiStationService: typeof real = GLOBAL_CONFIG.vigilMock ? vigilMock : real;

export const isVigilMock = GLOBAL_CONFIG.vigilMock;
export default aiStationService;
