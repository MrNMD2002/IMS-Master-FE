/** Kiểu dữ liệu theo schema của CMC API (app/schemas/*.py). */

// ── Phạm vi / người dùng ────────────────────────────────────────────────────

export interface ScopeInfo {
	kind: "all" | "subtree" | "one";
	tenant_ids?: number[];
}

export type DeviceStatus = "ACTIVE" | "INACTIVE" | "LOST" | "MAINTENANCE";
export const DEVICE_STATUSES: DeviceStatus[] = ["ACTIVE", "INACTIVE", "LOST", "MAINTENANCE"];

export interface Device {
	id: number;
	name: string;
	imei: string;
	device_type: number;
	device_type_name?: string | null;
	status: DeviceStatus;
	is_mobilized?: boolean | null;
	mqtt_key?: string | null;
	mqtt_gps_topic?: string | null;
	mqtt_dispatch_topic?: string | null;
	tenant_id?: number | null;
	tenant_code?: string | null;
	tenant_name?: string | null;
	current_incident_id?: number | null;
	/** Điều động mới được không: trạng thái ACTIVE và loại phương tiện chưa bị khoá. */
	available?: boolean;
	unavailable_reason?: string | null;
}

export interface UserInfo {
	id: number;
	username: string;
	full_name?: string | null;
	avatar?: string | null;
	is_active: boolean;
	is_system_root?: boolean;
	role: string;
	tenant_id?: number | null;
	tenant_code?: string | null;
	tenant_name?: string | null;
	last_login?: string | null;
	permissions: string[];
	role_permissions?: string[] | null;
	direct_permissions?: string[] | null;
	scope?: { read: ScopeInfo; write: ScopeInfo } | null;
	device?: Device | null;
}

export interface UserToken {
	access_token?: string;
	refresh_token?: string;
}

export interface LoginResult {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
	user: UserInfo;
}

export interface UserCreateReq {
	username: string;
	password: string;
	full_name?: string;
	is_active?: boolean;
	role: string;
	tenant_id?: number | null;
	permissions?: string[] | null;
}

export interface UserUpdateReq {
	username?: string;
	full_name?: string;
	is_active?: boolean;
	role?: string;
	tenant_id?: number | null;
	permissions?: string[] | null;
}

export interface UserQuery {
	search?: string;
	tenant_id?: number;
	role?: string;
	is_active?: boolean;
	/** Có quyền này trong quyền hiệu lực (vai ∪ cấp lẻ). */
	permission?: string;
	/** true = có quyền cấp lẻ, false = chỉ quyền của vai. */
	has_direct?: boolean;
}

// ── Cây tổ chức ─────────────────────────────────────────────────────────────

export interface Tenant {
	id: number;
	code: string;
	name: string;
	is_active: boolean;
	is_default?: boolean;
	parent_tenant_id?: number | null;
	parent_code?: string | null;
	parent_name?: string | null;
	description?: string | null;
	city?: string | null;
	address_detail?: string | null;
	latitude?: number | string | null;
	longitude?: number | string | null;
	created_at?: string | null;
	updated_at?: string | null;
}

export interface TenantOption {
	id: number;
	code: string;
	name: string;
	parent_tenant_id?: number | null;
	is_active: boolean;
}

export interface TenantReq {
	code?: string;
	name?: string;
	parent_tenant_id?: number | null;
	is_active?: boolean;
	description?: string | null;
	city?: string | null;
	address_detail?: string | null;
	latitude?: number | null;
	longitude?: number | null;
}

// ── Thiết bị (xe) ───────────────────────────────────────────────────────────

export interface DeviceReq {
	name?: string;
	imei?: string;
	device_type?: number;
	status?: DeviceStatus;
	tenant_id?: number | null;
}

export interface DeviceQuery {
	search?: string;
	device_type?: number;
	status?: string;
	tenant_id?: number;
	is_mobilized?: boolean;
}

export interface DeviceUser {
	id: number;
	username: string;
	full_name?: string | null;
}

export interface DeviceType {
	id: number;
	code: string;
	name: string;
	icon?: string | null;
	is_active: boolean;
	sort_order: number;
}

export interface DeviceTypeReq {
	code?: string;
	name?: string;
	icon?: string | null;
	is_active?: boolean;
	sort_order?: number;
}

// ── GPS ─────────────────────────────────────────────────────────────────────

export interface GpsLatest {
	id: number; // device_id
	imei: string;
	name?: string | null;
	latitude: number;
	longitude: number;
	speed?: number | null;
	heading?: number | null;
	timestamp: number;
	created_at?: string | null;
	tenant_id?: number | null;
	tenant_name?: string | null;
	is_active: boolean;
	seconds_ago: number;
}

export interface GpsNearby {
	id: number;
	imei: string;
	name?: string | null;
	latitude: number;
	longitude: number;
	speed?: number | null;
	timestamp: number;
	tenant_id?: number | null;
	tenant_name?: string | null;
	distance_km?: number | null;
	device?: Device | null;
}

export interface GpsPoint {
	lat: number;
	lng: number;
	speed?: number | null;
	heading?: number | null;
	ts: number;
}

export interface GpsHistory {
	device_id: number;
	start: string;
	end: string;
	count: number;
	points: GpsPoint[];
}

// ── Sự vụ ───────────────────────────────────────────────────────────────────

export type IncidentStatus = "PROCESSING" | "PENDING_APPROVAL" | "COMPLETED";
export const INCIDENT_STATUSES: IncidentStatus[] = ["PROCESSING", "PENDING_APPROVAL", "COMPLETED"];

export interface DispatchedDevice {
	id: number;
	device_id: number;
	imei?: string | null;
	device_name?: string | null;
	gps_user_id?: number | null;
	gps_user_name?: string | null;
	status: string;
	confirmed: boolean;
	confirmed_at?: string | null;
	completed: boolean;
	completed_at?: string | null;
	note?: string | null;
}

/** Xe đã bị rút khỏi sự vụ (backend vẫn trả dòng này cho bên sở hữu để giữ lịch sử). */
export const isRecalled = (d: DispatchedDevice) => d.status === "CANCELED";
/** Xe đang làm nhiệm vụ trong sự vụ: chưa báo xong, chưa bị rút. */
export const isOnDuty = (d: DispatchedDevice) => !isRecalled(d) && !d.completed;
/** "đang làm / tổng" — tổng không tính xe đã rút; sự vụ đã đóng thì không xe nào còn làm. */
export const dutyCount = (list: DispatchedDevice[], closed = false) =>
	`${closed ? 0 : list.filter(isOnDuty).length}/${list.filter((d) => !isRecalled(d)).length}`;

export interface IncidentImage {
	id: number;
	url?: string | null;
	file_name?: string | null;
	file_size?: number | null;
	mime_type?: string | null;
	uploaded_by_user_id?: number | null;
	device_id?: number | null;
	created_at?: string | null;
}

export interface Incident {
	id: number;
	name: string;
	description?: string | null;
	status: IncidentStatus;
	location?: string | null;
	location_address?: string | null;
	lat?: number | null;
	lng?: number | null;
	name_reporter?: string | null;
	phone_number_reporter?: string | null;
	note?: string | null;
	tenant_id?: number | null;
	tenant_name?: string | null;
	dispatched_devices: DispatchedDevice[];
	images: IncidentImage[];
	created_by_user_id?: number | null;
	created_by?: { id: number; username: string; full_name?: string | null } | null;
	created_at?: string | null;
	updated_at?: string | null;
	closed_at?: string | null;
	has_active_devices: boolean;
}

export interface IncidentReq {
	name?: string;
	description?: string | null;
	tenant_id?: number | null;
	location?: string | null;
	location_address?: string | null;
	lat?: number | null;
	lng?: number | null;
	name_reporter?: string | null;
	phone_number_reporter?: string | null;
	note?: string | null;
	device_ids?: number[];
}

export interface IncidentQuery {
	search?: string;
	status?: string;
	tenant_id?: number;
	device_id?: number;
}

export type ReportPeriod = "day" | "week" | "month" | "year";

/** Khoảng ngày theo giờ Việt Nam (YYYY-MM-DD), gồm cả hai đầu. */
export interface IncidentReportQuery {
	period: ReportPeriod;
	date_from: string;
	date_to: string;
	tenant_id?: number;
}

export interface IncidentReportBucket extends Record<IncidentStatus, number> {
	bucket: string;
	total: number;
}

export interface IncidentReportStats {
	period: ReportPeriod;
	date_from: string;
	date_to: string;
	total: number;
	by_status: Record<IncidentStatus, number>;
	series: IncidentReportBucket[];
	by_tenant: { tenant_id: number; tenant_name: string; total: number }[];
}

export interface IncidentLog {
	id: number;
	action?: string | null;
	note?: string | null;
	device_id?: number | null;
	device_name?: string | null;
	device_imei?: string | null;
	actor_id?: number | null;
	actor_username?: string | null;
	actor_full_name?: string | null;
	created_at?: string | null;
}

// ── Vai trò / quyền ─────────────────────────────────────────────────────────

export interface Permission {
	id: number;
	code: string;
	name: string;
	description?: string | null;
	module?: string | null;
	is_grantable: boolean;
	is_system_permission: boolean;
}

export interface Role {
	id: number;
	name: string;
	code: string;
	description?: string | null;
	tenant_id?: number | null;
	permissions: string[];
}

export interface RoleReq {
	name?: string;
	code?: string;
	description?: string | null;
	tenant_id?: number | null;
	permission_codes?: string[];
}

// ── Nhật ký / cài đặt / tổng quan ───────────────────────────────────────────

export interface AuditLog {
	id: number;
	created_at: string;
	tenant_id?: number | null;
	actor_id?: number | null;
	actor_label?: string | null;
	action: string;
	resource?: string | null;
	resource_id?: string | null;
	method: string;
	path: string;
	outcome: string;
	status_code: number;
	ip?: string | null;
	user_agent?: string | null;
	request_id?: string | null;
	/** Chi tiết do thao tác tự gắn (vd cấu hình trước / sau, số dòng đã dọn). */
	meta?: Record<string, unknown> | null;
}

export interface AuditQuery {
	search?: string;
	tenant_id?: number;
	action?: string;
	outcome?: string;
	from_time?: string;
	to_time?: string;
}

export interface DashboardStats {
	total_devices: number;
	processing_incidents: number;
}
