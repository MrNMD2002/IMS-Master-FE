/** Danh mục camera tập trung (`/cameras`) — camera của đơn vị, gán cho một hay nhiều trạm AI xử lý. */

export interface CameraStationLink {
	station_id: string;
	station_name: string | null;
	station_online: boolean;
	/** Mã camera phía trạm (dùng cho lệnh / xem trực tiếp); null = đang chờ trạm trả lời. */
	remote_id: number | null;
	enabled: boolean | null;
	state: string | null;
	fps: number | null;
	resolution: string | null;
	plugins: string[];
}

export interface Camera {
	id: number;
	tenant_id: number;
	tenant_name: string | null;
	name: string;
	/** Đã che mật khẩu. */
	source: string;
	/** Nguồn đầy đủ — chỉ có với người có quyền quản lý. */
	source_full: string | null;
	location: string | null;
	latitude: number | null;
	longitude: number | null;
	note: string | null;
	/** `cmc` = thêm trên web, `station` = tự nhận từ trạm. */
	origin: "cmc" | "station";
	stations: CameraStationLink[];
	created_at: string | null;
	updated_at: string | null;
}

export interface CameraQuery {
	page?: number;
	page_size?: number;
	search?: string;
	tenant_id?: number;
	/** Mã trạm, hoặc `none` = chưa gán trạm nào. */
	station_id?: string;
}

export interface CameraInput {
	name: string;
	source: string;
	location?: string | null;
	latitude?: number | null;
	longitude?: number | null;
	note?: string | null;
	tenant_id?: number | null;
}

export interface PluginBindingInput {
	name: string;
	enabled?: boolean;
	params?: Record<string, unknown>;
}

export interface CameraPushResult {
	station_id: string;
	station_name: string | null;
	ok: boolean;
	error: string | null;
}

export interface CameraChange {
	camera: Camera;
	pushed: CameraPushResult[];
}
