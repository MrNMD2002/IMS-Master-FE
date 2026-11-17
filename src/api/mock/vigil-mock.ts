/**
 * Dữ liệu giả cho trang Trạm AI (Vigil) — chạy hoàn toàn trong trình duyệt, không gọi mạng.
 * Đúng hình dạng hợp đồng `cmc-contract.md` mục 4 để khi CMC API có `/ai-stations`, `/ai-events`
 * chỉ cần tắt cờ `VITE_AI_STATION_MOCK` (xem `aiStationService.ts`), không sửa trang.
 *
 * Thay đổi (tạo / đổi tên / xoá trạm, cấp lại mã) chỉ sống trong bộ nhớ, tải lại trang là mất.
 */
import type { Paged } from "#/api";
import type {
	AccelKind,
	AiCommand,
	AiCommandName,
	AiEvent,
	AiEventPage,
	AiEventQuery,
	AiEventStats,
	AiObject,
	AiStation,
	AiStationCreateReq,
	AiStationDetail,
	AiStationUpdateReq,
	AiStationWithToken,
	BBox,
	PluginInfo,
	StationCamera,
} from "#/vigil";

// ── Ngẫu nhiên có hạt giống: lần tải nào cũng ra cùng một bộ dữ liệu ─────────────────────────

function mulberry32(seed: number) {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const rand = mulberry32(20261116);
const between = (a: number, b: number) => a + rand() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

const sleep = (ms = between(180, 420)) => new Promise((r) => setTimeout(r, ms));

// ── Danh mục plugin (giống nhau trên mọi trạm, khác nhau ở bật/tắt) ───────────────────────

const HUMAN_MODEL = "human_det_v6.onnx";
const VEHICLE_MODEL = "vehicle_det_v6.onnx";

/** Đúng 5 plugin Vigil thật. */
const PLUGIN_CATALOG: PluginInfo[] = [
	{
		name: "people_counting",
		version: "1.0.0",
		display_name: "Đếm người",
		description: "Đếm số người đang có trong vùng đã vẽ.",
		enabled: true,
		event_types: ["people_count"],
		model: HUMAN_MODEL,
		params_schema: { min_score: { type: "number", default: 0.5 }, report_interval_s: { type: "integer", default: 60 } },
	},
	{
		name: "crowd_detection",
		version: "1.0.0",
		display_name: "Phát hiện đám đông",
		description: "Cảnh báo khi số người trong vùng vượt ngưỡng và kéo dài quá thời gian cho phép.",
		enabled: true,
		event_types: ["crowd"],
		model: HUMAN_MODEL,
		params_schema: { threshold: { type: "integer", default: 20 }, sustained_secs: { type: "integer", default: 30 } },
	},
	{
		name: "smoke_fire_detection",
		version: "1.1.0",
		display_name: "Phát hiện khói lửa",
		description: "Phát hiện lửa và khói, cảnh báo khi xuất hiện liên tiếp nhiều khung hình.",
		enabled: true,
		event_types: ["fire", "smoke"],
		model: "fire_smoke_yolo.onnx",
		params_schema: { min_score: { type: "number", default: 0.55 }, min_frames: { type: "integer", default: 5 } },
	},
	{
		name: "parking_violation_detection",
		version: "1.0.0",
		display_name: "Đậu xe vi phạm",
		description: "Phát hiện ô tô, xe tải, xe buýt dừng đỗ trong vùng cấm quá thời gian cho phép.",
		enabled: true,
		event_types: ["illegal_parking"],
		model: VEHICLE_MODEL,
		params_schema: { max_parked_secs: { type: "integer", default: 120 } },
	},
	{
		name: "traffic_violation_detection",
		version: "0.1.0",
		display_name: "Vi phạm giao thông",
		description: "Phát hiện xe vượt đèn đỏ, đi ngược chiều và đọc biển số (đang thử nghiệm).",
		enabled: true,
		event_types: ["red_light", "wrong_way"],
		model: VEHICLE_MODEL,
	},
];

/** Loại sự kiện mỗi plugin sinh ra, kèm trọng số (loại hay gặp hơn có trọng số lớn hơn). */
const PLUGIN_EVENT: Record<string, [string, number][]> = {
	people_counting: [["people_count", 1]],
	crowd_detection: [["crowd", 1]],
	smoke_fire_detection: [
		["smoke", 0.65],
		["fire", 0.35],
	],
	parking_violation_detection: [["illegal_parking", 1]],
	traffic_violation_detection: [
		["red_light", 0.6],
		["wrong_way", 0.4],
	],
};
/** Tần suất tương đối giữa các plugin trên cùng camera. */
const PLUGIN_RATE: Record<string, number> = {
	people_counting: 3,
	crowd_detection: 1,
	smoke_fire_detection: 1,
	parking_violation_detection: 2,
	traffic_violation_detection: 2.5,
};

function weighted<T>(items: [T, number][]): T {
	let r = rand() * items.reduce((n, [, w]) => n + w, 0);
	for (const [v, w] of items) {
		r -= w;
		if (r < 0) return v;
	}
	return items[items.length - 1][0];
}

// ── Trạm + camera ──────────────────────────────────────────────────────────────────────────

interface SeedStation {
	id: string;
	name: string;
	location: string;
	tenant_name: string;
	hostname: string;
	version: string;
	accel: AccelKind;
	gpu: string | null;
	/** null = đang trực tuyến; số = mất kết nối từ bao nhiêu phút trước. */
	offlineMinutes: number | null;
	paired: boolean;
	disabledPlugins: string[];
	cameras: StationCamera[];
	zones: string[];
	createdDaysAgo: number;
}

const cam = (
	id: number,
	name: string,
	state: StationCamera["state"],
	plugins: string[],
	resolution = "1920x1080",
): StationCamera => ({
	id,
	name,
	enabled: state !== "off",
	state,
	fps: state === "live" ? round(between(12.5, 15), 1) : 0,
	resolution,
	plugins,
});

const SEED: SeedStation[] = [
	{
		id: "st-7f3a",
		name: "Trạm Kho A — Đông Anh",
		location: "Kho tổng hợp A, xã Kim Chung, Đông Anh, Hà Nội",
		tenant_name: "Phòng Cảnh sát PCCC",
		hostname: "TRAM-KHO-A",
		version: "0.2.0",
		accel: "cuda",
		gpu: "NVIDIA GeForce RTX 3060",
		offlineMinutes: null,
		paired: true,
		disabledPlugins: ["traffic_violation_detection", "crowd_detection"],
		zones: ["Cổng", "Kho", "Bãi xe", "Hành lang"],
		createdDaysAgo: 41,
		cameras: [
			cam(1, "Cổng chính", "live", ["people_counting", "parking_violation_detection"]),
			cam(2, "Kho hàng dãy B", "live", ["smoke_fire_detection"]),
			cam(3, "Bãi xe sau", "live", ["parking_violation_detection", "smoke_fire_detection"], "2560x1440"),
			cam(4, "Hành lang kỹ thuật", "error", ["smoke_fire_detection"], "1280x720"),
		],
	},
	{
		id: "st-2c91",
		name: "Trạm cổng KCN Thăng Long",
		location: "Cổng số 2, KCN Thăng Long, Đông Anh, Hà Nội",
		tenant_name: "Công an huyện Đông Anh",
		hostname: "VIGIL-KCN-TL",
		version: "0.2.0",
		accel: "tensorrt",
		gpu: "NVIDIA Jetson Orin Nano",
		offlineMinutes: null,
		paired: true,
		disabledPlugins: [],
		zones: ["Làn vào", "Làn ra", "Sảnh bảo vệ"],
		createdDaysAgo: 28,
		cameras: [
			cam(1, "Làn xe vào", "live", ["traffic_violation_detection"]),
			cam(2, "Làn xe ra", "live", ["traffic_violation_detection", "parking_violation_detection"]),
			cam(3, "Nhà bảo vệ", "live", ["people_counting", "crowd_detection"], "1280x720"),
		],
	},
	{
		id: "st-a04e",
		name: "Trạm chợ Long Biên",
		location: "Chợ đầu mối Long Biên, Phúc Xá, Ba Đình, Hà Nội",
		tenant_name: "Công an quận Ba Đình",
		hostname: "LB-MARKET-01",
		version: "0.1.4",
		accel: "cpu",
		gpu: null,
		offlineMinutes: 47,
		paired: true,
		disabledPlugins: ["traffic_violation_detection", "parking_violation_detection"],
		zones: ["Khu A", "Khu B"],
		createdDaysAgo: 19,
		cameras: [
			cam(1, "Lối vào khu A", "off", ["people_counting", "crowd_detection", "smoke_fire_detection"]),
			cam(2, "Kho lạnh", "off", ["smoke_fire_detection"], "1280x720"),
		],
	},
	{
		id: "st-5be2",
		name: "Trạm bến xe Mỹ Đình",
		location: "Bến xe Mỹ Đình, Nam Từ Liêm, Hà Nội",
		tenant_name: "Công an quận Nam Từ Liêm",
		hostname: "BXMD-VIGIL",
		version: "0.2.0",
		accel: "openvino",
		gpu: "Intel Iris Xe Graphics",
		offlineMinutes: null,
		paired: true,
		disabledPlugins: ["traffic_violation_detection"],
		zones: ["Sảnh chờ", "Bãi đỗ"],
		createdDaysAgo: 9,
		cameras: [
			cam(1, "Sảnh chờ tầng 1", "live", ["people_counting", "crowd_detection", "smoke_fire_detection"]),
			cam(2, "Bãi đỗ xe khách", "connecting", ["parking_violation_detection"]),
		],
	},
];

interface MockStation extends SeedStation {
	offlineSince: number | null;
	createdAt: number;
	tenant_id: number | null;
	/** % tài nguyên nền, mỗi lần xem chi tiết dao động quanh mức này. */
	cpu: number;
	ram: number;
	gpuPct: number | null;
}

const NOW = Date.now();
const DAY = 86_400_000;

const stations: MockStation[] = SEED.map((s) => ({
	...s,
	offlineSince: s.offlineMinutes == null ? null : NOW - s.offlineMinutes * 60_000,
	createdAt: NOW - s.createdDaysAgo * DAY,
	tenant_id: null,
	cpu: round(between(18, 62), 1),
	ram: round(between(35, 71), 1),
	gpuPct: s.gpu ? round(between(22, 68), 1) : null,
}));

// ── Ảnh bằng chứng giả: SVG vẽ tại chỗ, vật thể nằm đúng chỗ bbox ─────────────────────────────

const W = 960;
const H = 540;

const SCENES: { sky: [string, string]; ground: string; accent: string }[] = [
	{ sky: ["#3b4a5c", "#6b7c8f"], ground: "#4a4f55", accent: "#8a9199" },
	{ sky: ["#1f2a36", "#3a4b5e"], ground: "#33383d", accent: "#5f6870" },
	{ sky: ["#58677a", "#9aa7b6"], ground: "#5d6166", accent: "#a3aab2" },
	{ sky: ["#2a3340", "#4d5a6b"], ground: "#3c4248", accent: "#717a84" },
];

function drawObject(o: AiObject): string {
	const x = o.bbox.x * W;
	const y = o.bbox.y * H;
	const w = o.bbox.w * W;
	const h = o.bbox.h * H;
	const cx = x + w / 2;
	switch (o.class.toLowerCase()) {
		case "fire":
			return `<path d="M${cx} ${y} C ${x + w} ${y + h * 0.45}, ${x + w} ${y + h}, ${cx} ${y + h} C ${x} ${y + h}, ${x} ${y + h * 0.45}, ${cx} ${y} Z" fill="#ff7a1a" opacity="0.92"/><path d="M${cx} ${y + h * 0.35} C ${x + w * 0.8} ${y + h * 0.65}, ${x + w * 0.75} ${y + h}, ${cx} ${y + h} C ${x + w * 0.25} ${y + h}, ${x + w * 0.2} ${y + h * 0.65}, ${cx} ${y + h * 0.35} Z" fill="#ffd34d"/>`;
		case "smoke":
			return `<g fill="#c9ced4" opacity="0.7"><ellipse cx="${cx}" cy="${y + h * 0.65}" rx="${w * 0.45}" ry="${h * 0.32}"/><ellipse cx="${x + w * 0.35}" cy="${y + h * 0.35}" rx="${w * 0.3}" ry="${h * 0.25}"/><ellipse cx="${x + w * 0.65}" cy="${y + h * 0.3}" rx="${w * 0.3}" ry="${h * 0.26}"/></g>`;
		case "person":
			return `<g fill="#1d2329"><circle cx="${cx}" cy="${y + h * 0.13}" r="${Math.min(w, h) * 0.18}"/><rect x="${x + w * 0.22}" y="${y + h * 0.27}" width="${w * 0.56}" height="${h * 0.73}" rx="${w * 0.2}"/></g>`;
		case "car":
		case "truck":
		case "bus":
			return `<g><rect x="${x}" y="${y + h * 0.3}" width="${w}" height="${h * 0.55}" rx="${h * 0.12}" fill="${o.class === "truck" ? "#6d5a3c" : o.class === "bus" ? "#2f7a4f" : "#2f5d8a"}"/><rect x="${x + w * 0.2}" y="${y}" width="${w * 0.55}" height="${h * 0.38}" rx="${h * 0.1}" fill="#3f6f9a"/><circle cx="${x + w * 0.22}" cy="${y + h * 0.86}" r="${h * 0.13}" fill="#111"/><circle cx="${x + w * 0.78}" cy="${y + h * 0.86}" r="${h * 0.13}" fill="#111"/></g>`;
		default:
			return `<g><rect x="${x + w * 0.1}" y="${y + h * 0.35}" width="${w * 0.8}" height="${h * 0.35}" rx="${h * 0.1}" fill="#7a3b3b"/><circle cx="${x + w * 0.2}" cy="${y + h * 0.82}" r="${h * 0.16}" fill="#111"/><circle cx="${x + w * 0.8}" cy="${y + h * 0.82}" r="${h * 0.16}" fill="#111"/><circle cx="${cx}" cy="${y + h * 0.15}" r="${h * 0.14}" fill="#1d2329"/></g>`;
	}
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function evidenceSvg(e: AiEvent): string {
	const scene = SCENES[(e.camera_id + e.station_id.charCodeAt(3)) % SCENES.length];
	const horizon = H * 0.48;
	const d = new Date(e.captured_at.wall_us / 1000);
	const pad = (n: number) => String(n).padStart(2, "0");
	const stamp = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	const buildings = [0.04, 0.2, 0.42, 0.63, 0.8]
		.map((bx, i) => {
			const bh = 60 + ((e.camera_id * 37 + i * 53) % 120);
			return `<rect x="${bx * W}" y="${horizon - bh}" width="${110 + ((i * 29) % 60)}" height="${bh}" fill="${scene.accent}" opacity="0.55"/>`;
		})
		.join("");
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${scene.sky[0]}"/><stop offset="1" stop-color="${scene.sky[1]}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#s)"/>${buildings}<rect y="${horizon}" width="${W}" height="${H - horizon}" fill="${scene.ground}"/><path d="M${W * 0.38} ${H} L${W * 0.47} ${horizon} L${W * 0.53} ${horizon} L${W * 0.62} ${H} Z" fill="#000" opacity="0.12"/>${e.objects.map(drawObject).join("")}<rect x="0" y="0" width="${W}" height="34" fill="#000" opacity="0.45"/><text x="12" y="23" font-family="monospace" font-size="17" fill="#fff">${esc(e.camera_name)}</text><text x="${W - 12}" y="23" font-family="monospace" font-size="17" fill="#fff" text-anchor="end">${stamp}</text><text x="12" y="${H - 12}" font-family="sans-serif" font-size="13" fill="#fff" opacity="0.55">ẢNH MINH HOẠ · DỮ LIỆU GIẢ</text></svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ── Sự kiện ────────────────────────────────────────────────────────────────────────────────

function uuidv7(ms: number): string {
	const hex = (n: number, len: number) => Math.floor(n).toString(16).padStart(len, "0").slice(-len);
	const ts = hex(ms, 12);
	const r = () => hex(rand() * 0x10000, 4);
	return `${ts.slice(0, 8)}-${ts.slice(8)}-7${r().slice(1)}-${(8 + int(0, 3)).toString(16)}${r().slice(1)}-${r()}${r()}${r()}`;
}

function bbox(cls: string): BBox {
	const size: Record<string, [number, number]> = {
		fire: [0.08, 0.16],
		smoke: [0.16, 0.28],
		person: [0.04, 0.07],
		car: [0.12, 0.2],
		truck: [0.16, 0.24],
		bus: [0.2, 0.28],
		motorbike: [0.05, 0.08],
	};
	const c = cls.toLowerCase();
	const [a, b] = size[c] ?? [0.06, 0.1];
	const w = between(a, b);
	const h = c === "person" ? w * between(2.2, 2.8) * (W / H) * 0.56 : w * between(0.55, 0.95) * (W / H);
	const y = c === "smoke" ? between(0.12, 0.35) : between(0.45, 0.92 - h);
	return { x: round(between(0.03, 0.97 - w)), y: round(Math.max(0.06, y)), w: round(w), h: round(Math.min(h, 0.9)) };
}

const PLATE_SERIES = ["30A", "30E", "30G", "30H", "29A", "29C", "29D", "51F", "51G", "88A", "99A", "29LD"];
/** Biển số VN dạng "30A-123.45". */
const plate = () => `${pick(PLATE_SERIES)}-${int(100, 999)}.${String(int(0, 99)).padStart(2, "0")}`;

function makeObjects(
	type: string,
	zone: string,
): { objects: AiObject[]; extra: Record<string, unknown> | null; score: number } {
	let track = int(1, 900);
	const obj = (cls: string, lo: number, hi: number): AiObject => ({
		track_id: track++,
		class: cls,
		bbox: bbox(cls),
		score: round(between(lo, hi), 2),
	});
	const people = (n: number) => Array.from({ length: n }, () => obj("person", 0.55, 0.95));
	const avg = (os: AiObject[]) => round(os.reduce((s, o) => s + o.score, 0) / os.length, 2);

	if (type === "fire" || type === "smoke") {
		const main = obj(type === "fire" ? "Fire" : "Smoke", 0.58, 0.96);
		const objects = [main];
		if (type === "fire" && rand() < 0.5) objects.push(obj("Smoke", 0.5, 0.9));
		const max = round(Math.min(0.99, main.score + between(0, 0.04)), 2);
		return { objects, extra: { frames: int(5, 42), max_score: max, zone_name: zone }, score: main.score };
	}
	if (type === "people_count") {
		const count = int(2, 18);
		const objects = people(Math.min(count, 9));
		return { objects, extra: { count, zone_name: zone }, score: avg(objects) };
	}
	if (type === "crowd") {
		const threshold = pick([15, 20, 25]);
		const count = threshold + int(1, 22);
		const objects = people(int(8, 14));
		return {
			objects,
			extra: { count, threshold, sustained_secs: int(30, 420), zone_name: zone },
			score: avg(objects),
		};
	}
	if (type === "illegal_parking") {
		const cls = weighted<string>([
			["car", 6],
			["truck", 2],
			["bus", 1],
		]);
		const o = obj(cls, 0.62, 0.97);
		return {
			objects: [o],
			extra: { vehicle_class: cls, parked_secs: int(125, 2400), zone_name: zone },
			score: o.score,
		};
	}
	// red_light / wrong_way
	const cls = weighted<string>([
		["car", 5],
		["motorbike", 4],
		["truck", 1],
	]);
	const o = obj(cls, 0.6, 0.96);
	return {
		objects: [o],
		extra: { plate_text: plate(), vehicle_class: cls, zone_name: zone },
		score: o.score,
	};
}

/** Giờ trong ngày có nhiều sự kiện hơn (đông người ban ngày, lửa khói rải đều). */
const HOUR_WEIGHT = [1, 1, 1, 1, 1, 2, 4, 6, 7, 6, 5, 5, 6, 6, 5, 5, 6, 7, 7, 5, 4, 3, 2, 1];
const HOUR_TOTAL = HOUR_WEIGHT.reduce((a, b) => a + b, 0);
function randomHour() {
	let r = rand() * HOUR_TOTAL;
	for (let h = 0; h < 24; h++) {
		r -= HOUR_WEIGHT[h];
		if (r < 0) return h;
	}
	return 12;
}

function generateEvents(): AiEvent[] {
	const out: AiEvent[] = [];
	const today = new Date(NOW);
	today.setHours(0, 0, 0, 0);
	for (const st of stations) {
		const end = st.offlineSince ?? NOW;
		const start = Math.max(st.createdAt, NOW - 30 * DAY);
		const perDay = st.id === "st-2c91" ? 9 : st.id === "st-a04e" ? 4 : 6;
		for (let day = today.getTime() - 30 * DAY; day <= today.getTime(); day += DAY) {
			const n = Math.max(0, Math.round(perDay * between(0.4, 1.5)));
			for (let i = 0; i < n; i++) {
				const ms = day + randomHour() * 3_600_000 + int(0, 3_599_999);
				if (ms < start || ms > end) continue;
				const camera = pick(st.cameras);
				const plugins = camera.plugins.filter((p) => PLUGIN_EVENT[p] && !st.disabledPlugins.includes(p));
				if (!plugins.length) continue;
				const plugin = weighted(plugins.map((p) => [p, PLUGIN_RATE[p] ?? 1] as [string, number]));
				const type = weighted(PLUGIN_EVENT[plugin]);
				// Mỗi camera nhìn một vùng cố định.
				const zoneIdx = (camera.id - 1) % st.zones.length;
				const { objects, extra, score } = makeObjects(type, st.zones[zoneIdx]);
				const event_id = uuidv7(ms);
				const base: Omit<AiEvent, "image_url"> = {
					v: 1,
					event_id,
					station_id: st.id,
					station_name: st.name,
					camera_id: camera.id,
					camera_name: camera.name,
					plugin,
					event_type: type,
					score,
					captured_at: { pts_us: int(0, 9e9), wall_us: ms * 1000 },
					sent_at: (ms + int(80, 900)) * 1000,
					zone_id: zoneIdx + 1,
					zone_name: st.zones[zoneIdx],
					objects,
					evidence: {
						frame_key: `vigil/${st.id}/${new Date(ms).toISOString().slice(0, 10).replace(/-/g, "/")}/${event_id.slice(0, 8)}.jpg`,
						crop_key: null,
					},
					extra,
				};
				out.push({ ...base, image_url: null });
			}
		}
	}
	return out.sort((a, b) => b.captured_at.wall_us - a.captured_at.wall_us);
}

let events: AiEvent[] = generateEvents();

/** Ảnh vẽ lúc cần (vài trăm chuỗi SVG không đáng tạo trước). */
const withImage = (e: AiEvent): AiEvent => {
	e.image_url ??= evidenceSvg(e);
	return e;
};

// ── Chuyển đổi sang hình dạng API ──────────────────────────────────────────────────────────

const startOfToday = () => {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d.getTime();
};

function lastSeen(st: MockStation): string | null {
	if (!st.paired) return null;
	if (st.offlineSince != null) return new Date(st.offlineSince).toISOString();
	// Nhịp trạng thái 30 giây một lần.
	return new Date(Date.now() - ((Date.now() / 1000) % 30) * 1000).toISOString();
}

function toStation(st: MockStation): AiStation {
	const online = st.paired && st.offlineSince == null;
	const t0 = startOfToday() * 1000;
	const live = online ? st.cameras.filter((c) => c.state === "live").length : 0;
	const alarms = online
		? st.cameras
				.filter((c) => c.state === "error")
				.map((c) => `Camera ${c.id} (${c.name}): mất tín hiệu`)
				.concat(st.cpu > 85 ? ["CPU quá tải"] : [])
		: [];
	return {
		id: st.id,
		name: st.name,
		location: st.location,
		tenant_id: st.tenant_id,
		tenant_name: st.tenant_name,
		online,
		last_seen: lastSeen(st),
		version: st.paired ? st.version : null,
		accel: st.paired ? st.accel : null,
		gpu: st.paired ? st.gpu : null,
		cameras_live: live,
		cameras_total: st.cameras.length,
		alarms,
		events_today: events.filter((e) => e.station_id === st.id && e.captured_at.wall_us >= t0).length,
		paired: st.paired,
		created_at: new Date(st.createdAt).toISOString(),
	};
}

function toDetail(st: MockStation): AiStationDetail {
	const base = toStation(st);
	// Dao động nhẹ tài nguyên mỗi lần xem để thấy "sống".
	const jitter = (v: number) => round(Math.min(99, Math.max(3, v + (Math.random() - 0.5) * 8)), 1);
	return {
		...base,
		status: st.paired
			? {
					v: 1,
					online: base.online,
					version: st.version,
					config_revision: 0,
					cameras_live: base.cameras_live,
					cameras_total: base.cameras_total,
					alarms: base.alarms,
					ts: base.last_seen ? new Date(base.last_seen).getTime() : Date.now(),
					hostname: st.hostname,
					accel: st.accel,
					gpu: st.gpu,
					cpu_pct: base.online ? jitter(st.cpu) : null,
					ram_pct: base.online ? jitter(st.ram) : null,
					gpu_pct: base.online && st.gpuPct != null ? jitter(st.gpuPct) : null,
				}
			: null,
		plugins: st.paired ? PLUGIN_CATALOG.map((p) => ({ ...p, enabled: !st.disabledPlugins.includes(p.name) })) : [],
		cameras: st.cameras.map((c) =>
			base.online
				? { ...c, fps: c.state === "live" ? round(Math.max(1, c.fps + (Math.random() - 0.5)), 1) : 0 }
				: { ...c, state: c.enabled ? ("off" as const) : c.state, fps: 0 },
		),
	};
}

const notFound = () => Object.assign(new Error("Không tìm thấy trạm"), { code: "404" });
const findStation = (id: string) => {
	const st = stations.find((s) => s.id === id);
	if (!st) throw notFound();
	return st;
};

const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newPairingToken() {
	const buf = new Uint32Array(12);
	crypto.getRandomValues(buf);
	const chars = Array.from(buf, (n) => TOKEN_ALPHABET[n % TOKEN_ALPHABET.length]).join("");
	return `VGL-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

function filterEvents(q: AiEventQuery): AiEvent[] {
	const from = q.from ? new Date(q.from).getTime() * 1000 : null;
	const to = q.to ? new Date(q.to).getTime() * 1000 : null;
	return events.filter(
		(e) =>
			(!q.station_id || e.station_id === q.station_id) &&
			(q.camera_id == null || e.camera_id === q.camera_id) &&
			(!q.plugin || e.plugin === q.plugin) &&
			(!q.event_type || e.event_type === q.event_type) &&
			(from == null || e.captured_at.wall_us >= from) &&
			(to == null || e.captured_at.wall_us <= to),
	);
}

const localDay = (ms: number) => {
	const d = new Date(ms);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// ── API giả ────────────────────────────────────────────────────────────────────────────────

const mockCommands = new Map<string, AiCommand[]>();

/** Ảnh chụp giả: khung xám ghi tên camera. */
const fakeSnapshot = (name: string) =>
	`data:image/svg+xml;utf8,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="100%" height="100%" fill="#1f2937"/><text x="50%" y="50%" fill="#e5e7eb" font-family="sans-serif" font-size="40" text-anchor="middle">${name} — ảnh chụp thử</text></svg>`,
	)}`;

export const vigilMock = {
	async listStations(params: { page?: number; page_size?: number; search?: string }): Promise<Paged<AiStation>> {
		await sleep();
		const kw = params.search?.trim().toLowerCase();
		const all = stations
			.map(toStation)
			.filter(
				(s) =>
					!kw ||
					s.name.toLowerCase().includes(kw) ||
					s.id.includes(kw) ||
					(s.location ?? "").toLowerCase().includes(kw),
			);
		const page = params.page ?? 1;
		const size = params.page_size ?? 50;
		return {
			data: all.slice((page - 1) * size, page * size),
			metadata: { current_page: page, page_size: size, total_items: all.length },
		};
	},

	async getStation(id: string): Promise<AiStationDetail> {
		await sleep();
		return toDetail(findStation(id));
	},

	async createStation(req: AiStationCreateReq): Promise<AiStationWithToken> {
		await sleep();
		const id = `st-${Array.from(crypto.getRandomValues(new Uint8Array(2)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
		const st: MockStation = {
			id,
			name: req.name?.trim() || "Trạm AI mới",
			location: req.location?.trim() ?? "",
			tenant_name: "—",
			hostname: "",
			version: "",
			accel: "cpu",
			gpu: null,
			offlineMinutes: null,
			paired: false,
			disabledPlugins: [],
			zones: [],
			createdDaysAgo: 0,
			cameras: [],
			offlineSince: null,
			createdAt: Date.now(),
			tenant_id: req.tenant_id ?? null,
			cpu: 0,
			ram: 0,
			gpuPct: null,
		};
		stations.unshift(st);
		return { station: toStation(st), pairing_token: newPairingToken() };
	},

	async updateStation(id: string, req: AiStationUpdateReq): Promise<AiStation> {
		await sleep();
		const st = findStation(id);
		if (req.name !== undefined) st.name = req.name.trim();
		if (req.location !== undefined) st.location = req.location.trim();
		for (const e of events) if (e.station_id === id) e.station_name = st.name;
		return toStation(st);
	},

	async rotateToken(id: string): Promise<AiStationWithToken> {
		await sleep();
		const st = findStation(id);
		return { station: toStation(st), pairing_token: newPairingToken() };
	},

	async deleteStation(id: string): Promise<void> {
		await sleep();
		findStation(id);
		stations.splice(
			stations.findIndex((s) => s.id === id),
			1,
		);
		events = events.filter((e) => e.station_id !== id);
	},

	async sendCommand(id: string, req: { cmd: AiCommandName; camera_id?: number }): Promise<AiCommand> {
		await sleep(between(500, 1200));
		const st = findStation(id);
		if (st.offlineSince != null) throw new Error("Trạm đang mất kết nối — lệnh không tới được trạm");
		const cam = st.cameras.find((c) => c.id === req.camera_id);
		if (!cam) throw notFound();
		const now = new Date().toISOString();
		const cmd: AiCommand = {
			id: crypto.randomUUID(),
			station_id: id,
			cmd: req.cmd,
			camera_id: cam.id,
			camera_name: cam.name,
			args: {},
			status: "ok",
			error: null,
			result: {},
			image_url: null,
			created_by_name: "Quản trị viên",
			created_at: now,
			acked_at: now,
		};
		if (req.cmd === "camera_enable" || req.cmd === "camera_disable") {
			cam.enabled = req.cmd === "camera_enable";
			cam.state = cam.enabled ? "live" : "off";
			cmd.result = { enabled: cam.enabled };
		} else if (req.cmd === "camera_restart" && !cam.enabled) {
			cmd.status = "error";
			cmd.error = "camera đang tắt — bật camera trước";
		} else if (req.cmd === "snapshot") {
			cmd.result = { width: 1280, height: 720 };
			cmd.image_url = fakeSnapshot(cam.name);
		}
		mockCommands.set(id, [cmd, ...(mockCommands.get(id) ?? [])].slice(0, 30));
		return cmd;
	},

	async listCommands(id: string): Promise<AiCommand[]> {
		await sleep();
		findStation(id);
		return mockCommands.get(id) ?? [];
	},

	async listEvents(q: AiEventQuery): Promise<AiEventPage> {
		await sleep();
		const all = filterEvents(q);
		const page = q.page ?? 1;
		const size = q.page_size ?? 20;
		return { items: all.slice((page - 1) * size, page * size).map(withImage), total: all.length };
	},

	async getEvent(eventId: string): Promise<AiEvent> {
		await sleep(120);
		const e = events.find((x) => x.event_id === eventId);
		if (!e) throw Object.assign(new Error("Không tìm thấy sự kiện"), { code: "404" });
		return withImage(e);
	},

	async eventStats(q: Omit<AiEventQuery, "page" | "page_size">): Promise<AiEventStats> {
		await sleep();
		const list = filterEvents(q);
		const fromMs = q.from ? new Date(q.from).getTime() : NOW - 13 * DAY;
		const toMs = q.to ? Math.min(new Date(q.to).getTime(), Date.now()) : Date.now();
		const days: AiEventStats["by_day"] = [];
		const index = new Map<string, AiEventStats["by_day"][number]>();
		const cursor = new Date(fromMs);
		cursor.setHours(0, 0, 0, 0);
		while (cursor.getTime() <= toMs) {
			const row = { day: localDay(cursor.getTime()), total: 0, by_type: {} as Record<string, number> };
			days.push(row);
			index.set(row.day, row);
			cursor.setDate(cursor.getDate() + 1);
		}
		const byType = new Map<string, number>();
		const byStation = new Map<string, { station_id: string; station_name: string; total: number }>();
		let scoreSum = 0;
		for (const e of list) {
			const row = index.get(localDay(e.captured_at.wall_us / 1000));
			if (row) {
				row.total++;
				row.by_type[e.event_type] = (row.by_type[e.event_type] ?? 0) + 1;
			}
			byType.set(e.event_type, (byType.get(e.event_type) ?? 0) + 1);
			const s = byStation.get(e.station_id) ?? { station_id: e.station_id, station_name: e.station_name, total: 0 };
			s.total++;
			byStation.set(e.station_id, s);
			scoreSum += e.score;
		}
		return {
			by_day: days,
			by_type: [...byType].map(([event_type, total]) => ({ event_type, total })).sort((a, b) => b.total - a.total),
			by_station: [...byStation.values()].sort((a, b) => b.total - a.total),
			total: list.length,
			avg_score: list.length ? round(scoreSum / list.length, 3) : null,
		};
	},
};
