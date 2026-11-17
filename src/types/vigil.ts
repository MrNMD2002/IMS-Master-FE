/**
 * Kiểu dữ liệu trạm AI Vigil — theo hợp đồng `Vigil-Master/docs/cmc-contract.md` (v1).
 * Mục 2 (MQTT) cho `StationStatus` / `PluginInfo` / `StationCamera` / `AiObject`,
 * mục 4 (API cho Web) cho `AiStation*` / `AiEvent*`.
 */

export type AccelKind = "cuda" | "tensorrt" | "openvino" | "directml" | "cpu";
export type CameraState = "live" | "connecting" | "error" | "off";
export type AiEventType =
	| "people_count"
	| "crowd"
	| "fire"
	| "smoke"
	| "zone_intrusion"
	| "illegal_parking"
	| "red_light"
	| "wrong_way";
export const AI_EVENT_TYPES: AiEventType[] = [
	"people_count",
	"crowd",
	"fire",
	"smoke",
	"zone_intrusion",
	"illegal_parking",
	"red_light",
	"wrong_way",
];

/** `StationStatus` — bản tin `cmc/vigil/<station_id>/status` mới nhất. */
export interface StationStatus {
	v: 1;
	online: boolean;
	version: string;
	config_revision: number;
	cameras_live: number;
	cameras_total: number;
	alarms: string[];
	/** epoch ms */
	ts: number;
	hostname: string;
	accel: AccelKind;
	gpu?: string | null;
	cpu_pct?: number | null;
	ram_pct?: number | null;
	gpu_pct?: number | null;
}

/** Một mục trong `PluginCatalog`. */
export interface PluginInfo {
	name: string;
	version: string;
	display_name: string;
	description?: string;
	/** Công tắc chung của plugin trên trạm (đổi bằng lệnh `plugin_settings`). */
	enabled: boolean;
	/** Đang chạy trên ít nhất một camera bật (trạm cũ không gửi). */
	in_use?: boolean;
	/** Tệp model plugin cần mà trạm chưa có — khác rỗng thì plugin không bật được. */
	missing_models?: string[];
	event_types: string[];
	model?: string | null;
	params_schema?: Record<string, unknown>;
}

/** Một mục trong `CameraList` (không có URL nguồn). */
export interface StationCamera {
	id: number;
	name: string;
	enabled: boolean;
	state: CameraState;
	fps: number;
	resolution: string;
	plugins: string[];
}

/** Một dòng của `GET /ai-stations`. */
export interface AiStation {
	id: string;
	name: string;
	location?: string | null;
	tenant_id?: number | null;
	tenant_name?: string | null;
	online: boolean;
	/** ISO 8601; null = chưa từng kết nối (chưa ghép nối). */
	last_seen: string | null;
	version?: string | null;
	accel?: AccelKind | null;
	gpu?: string | null;
	cameras_live: number;
	cameras_total: number;
	alarms: string[];
	events_today: number;
	/** Đã ghép nối chưa (mã đã được Vigil dùng). */
	paired: boolean;
	/** Lần ghép nối đầu (UTC). */
	paired_at?: string | null;
	created_at: string;
	/** Giữ sự kiện bao nhiêu ngày (1–365) — đồng bộ hai chiều với Vigil. */
	retention_days?: number;
}

/** `GET /ai-stations/{id}` */
export interface AiStationDetail extends AiStation {
	status: StationStatus | null;
	plugins: PluginInfo[];
	cameras: StationCamera[];
}

export interface AiStationCreateReq {
	/** Bỏ trống = tên đặt trên Vigil lúc ghép nối. */
	name?: string;
	location?: string;
	tenant_id?: number | null;
}

export interface AiStationUpdateReq {
	name?: string;
	location?: string;
}

/** Kết quả tạo trạm / cấp lại mã — `pairing_token` chỉ hiện một lần. */
export interface AiStationWithToken {
	station: AiStation;
	pairing_token: string;
}

export interface BBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface AiObject {
	track_id?: number | null;
	class: string;
	bbox: BBox;
	score: number;
}

/** Một mục `items[]` của `GET /ai-events` — `AlertEvent` + `station_*` + `image_url`. */
export interface AiEvent {
	v: 1;
	event_id: string;
	station_id: string;
	station_name: string;
	camera_id: number;
	camera_name: string;
	plugin: string;
	event_type: AiEventType | string;
	score: number;
	captured_at: { pts_us: number; wall_us: number };
	sent_at: number;
	zone_id?: number | null;
	zone_name?: string | null;
	objects: AiObject[];
	evidence: { frame_key: string | null; crop_key: string | null };
	extra?: Record<string, unknown> | null;
	image_url: string | null;
	/** Ảnh cắt (biển số xe vi phạm) — link ký sẵn như `image_url`. */
	crop_url?: string | null;
}

export interface AiEventQuery {
	page?: number;
	page_size?: number;
	station_id?: string;
	camera_id?: number;
	plugin?: string;
	event_type?: string;
	/** ISO 8601 */
	from?: string;
	to?: string;
}

export interface AiEventPage {
	items: AiEvent[];
	total: number;
}

export interface AiEventStats {
	by_day: { day: string; total: number; by_type: Record<string, number> }[];
	by_type: { event_type: string; total: number }[];
	by_station: { station_id: string; station_name: string; total: number }[];
	total: number;
	avg_score: number | null;
	/** Top 20 camera nhiều sự kiện nhất. */
	by_camera?: {
		station_id: string;
		station_name: string | null;
		camera_id: number;
		camera_name: string | null;
		total: number;
	}[];
	/** 24 ô theo giờ Việt Nam. */
	by_hour?: number[];
	/** Từ `extra.count` (đếm người, đám đông). */
	peak_count?: number | null;
	avg_count?: number | null;
	/** Từ `extra.sustained_secs` / `parked_secs` / `dwell_seconds`. */
	avg_duration_s?: number | null;
	max_duration_s?: number | null;
}

/** Lệnh CMC gửi xuống trạm (`POST /ai-stations/{id}/commands`). */
export type AiCommandName =
	| "camera_enable"
	| "camera_disable"
	| "camera_restart"
	| "snapshot"
	| "camera_create"
	| "camera_update"
	| "camera_delete"
	| "camera_plugins"
	| "camera_zones"
	| "plugin_settings"
	| "station_settings";

export interface AiCommand {
	id: string;
	station_id: string;
	cmd: AiCommandName;
	camera_id: number | null;
	camera_name: string | null;
	args: Record<string, unknown>;
	/** `pending` đang chờ trạm · `timeout` trạm chưa trả lời kịp (kết quả về muộn vẫn cập nhật). */
	status: "pending" | "ok" | "error" | "timeout";
	error: string | null;
	result: Record<string, unknown>;
	/** Ảnh chụp (lệnh `snapshot`) — đường dẫn API, tải kèm token. */
	image_url: string | null;
	created_by_name: string | null;
	created_at: string;
	acked_at: string | null;
}
