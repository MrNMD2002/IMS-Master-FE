import { useQuery } from "@tanstack/react-query";
import { DatePicker, Radio, Segmented, Select, Slider } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleMarker, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import { useSearchParams } from "react-router";
import type { GpsPoint } from "#/ims";
import deviceService from "@/api/services/deviceService";
import gpsService from "@/api/services/gpsService";
import { Icon } from "@/components/icon";
import EmptyState from "@/components/ims/empty-state";
import BaseMap from "@/components/ims/map/base-map";
import MapControls from "@/components/ims/map/map-controls";
import { vehicleIcon } from "@/components/ims/map/markers";
import PageHeader from "@/components/ims/page-header";
import StatCard from "@/components/ims/stat-card";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { fmtNumber } from "@/utils/format";

const { RangePicker } = DatePicker;
const SPEEDS = [0.5, 1, 4, 16, 64];

function haversineKm(a: GpsPoint, b: GpsPoint) {
	const R = 6371;
	const dLat = ((b.lat - a.lat) * Math.PI) / 180;
	const dLng = ((b.lng - a.lng) * Math.PI) / 180;
	const s =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(s));
}

function FitRoute({ points }: { points: GpsPoint[] }) {
	const map = useMap();
	useEffect(() => {
		if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [50, 50] });
	}, [points, map]);
	return null;
}

export default function ActivityPage() {
	const { t } = useTranslation();
	const [params, setParams] = useSearchParams();
	const [deviceId, setDeviceId] = useState<number | undefined>(
		params.get("device") ? Number(params.get("device")) : undefined,
	);
	const [deviceSearch, setDeviceSearch] = useState("");
	const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(6, "hour"), dayjs()]);
	// Nút khoảng nhanh đang chọn (null = khoảng tự chọn trên lịch).
	const [quickHours, setQuickHours] = useState<number | null>(6);
	const [query, setQuery] = useState<{ device_id: number; start: string; end: string } | null>(null);
	const [index, setIndex] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [speed, setSpeed] = useState(4);

	const devices = useQuery({
		queryKey: ["device", "pick", deviceSearch],
		queryFn: () => deviceService.list({ page_size: 50, search: deviceSearch || undefined }),
	});
	const selectedDevice = useQuery({
		queryKey: ["device", "detail", deviceId],
		queryFn: () => deviceService.detail(deviceId as number),
		enabled: !!deviceId,
	});

	const history = useQuery({
		queryKey: ["gps-history", query],
		queryFn: () => gpsService.history({ ...(query as NonNullable<typeof query>), limit: 10000 }),
		enabled: !!query,
	});
	const points = history.data?.points ?? [];

	// biome-ignore lint/correctness/useExhaustiveDependencies: về đầu mỗi khi tải lộ trình mới
	useEffect(() => {
		setIndex(0);
		setPlaying(false);
	}, [history.data]);

	// Phát lại: mỗi 200ms tiến `speed` điểm; dưới 1x thì giãn nhịp (0.5x = 1 điểm / 400ms).
	useEffect(() => {
		if (!playing) return;
		const step = Math.max(1, speed);
		const timer = setInterval(() => {
			setIndex((i) => {
				if (i >= points.length - 1) {
					setPlaying(false);
					return i;
				}
				return Math.min(i + step, points.length - 1);
			});
		}, 200 / Math.min(1, speed));
		return () => clearInterval(timer);
	}, [playing, speed, points.length]);

	const stats = useMemo(() => {
		let dist = 0;
		let max = 0;
		for (let i = 1; i < points.length; i++) dist += haversineKm(points[i - 1], points[i]);
		for (const p of points) max = Math.max(max, p.speed ?? 0);
		const dur = points.length > 1 ? points[points.length - 1].ts - points[0].ts : 0;
		return { dist, max, dur };
	}, [points]);

	const tooLong = range[1].diff(range[0], "hour", true) > 24;
	// Dữ liệu bắt đầu muộn hơn khoảng đã chọn (xe mới chạy / mới bật) → nói rõ, tránh tưởng 6h, 12h, 24h lọc sai.
	const dataStartsLate =
		!!query && points.length > 0 && points[0].ts - dayjs(query.start).unix() > 10 * 60
			? dayjs.unix(points[0].ts).format("HH:mm DD/MM")
			: null;

	const run = (id = deviceId, r = range) => {
		if (!id || r[1].diff(r[0], "hour", true) > 24) return;
		params.set("device", String(id));
		setParams(params, { replace: true });
		setQuery({ device_id: id, start: r[0].toISOString(), end: r[1].toISOString() });
	};

	// Vào trang kèm ?device= (từ bản đồ giám sát / danh sách xe) → hiện lộ trình luôn.
	// biome-ignore lint/correctness/useExhaustiveDependencies: chỉ chạy một lần khi mở trang
	useEffect(() => {
		if (deviceId) run();
	}, []);

	const current = points[index];
	const path = points.map((p) => [p.lat, p.lng] as [number, number]);
	const played = path.slice(0, index + 1);

	const deviceOptions = [
		...(selectedDevice.data && !devices.data?.data.some((d) => d.id === selectedDevice.data.id)
			? [selectedDevice.data]
			: []),
		...(devices.data?.data ?? []),
	].map((d) => ({ value: d.id, label: `${d.name} · ${d.imei}` }));

	const quick = (hours: number) => {
		const r: [Dayjs, Dayjs] = [dayjs().subtract(hours, "hour"), dayjs()];
		setRange(r);
		setQuickHours(hours);
		run(deviceId, r);
	};

	return (
		<>
			<PageHeader
				icon="solar:route-bold-duotone"
				title={t("sys.nav.activity")}
				description={t("activity.description")}
				toolbar={
					<>
						<Select
							showSearch
							filterOption={false}
							onSearch={setDeviceSearch}
							style={{ width: 300 }}
							prefix={<Icon icon="solar:bus-linear" size={16} className="text-text-secondary" />}
							placeholder={t("activity.pickVehicle")}
							value={deviceId}
							onChange={(id) => {
								setDeviceId(id);
								run(id);
							}}
							options={deviceOptions}
							loading={devices.isFetching}
						/>
						<RangePicker
							showTime={{ format: "HH:mm" }}
							format="DD/MM/YYYY HH:mm"
							value={range}
							onChange={(v) => {
								if (v?.[0] && v[1]) {
									setRange([v[0], v[1]]);
									setQuickHours(null);
								}
							}}
							status={tooLong ? "error" : undefined}
						/>
						{/* Khoảng nhanh: một nhóm nút liền, cùng chiều cao với các ô bên cạnh. */}
						<Radio.Group
							optionType="button"
							buttonStyle="solid"
							value={quickHours}
							onChange={(e) => quick(e.target.value)}
							options={[1, 6, 12, 24].map((h) => ({ value: h, label: `${h}h` }))}
						/>
						<Button onClick={() => run()} disabled={!deviceId || tooLong || history.isFetching}>
							<Icon icon={history.isFetching ? "svg-spinners:180-ring" : "solar:play-circle-bold"} size={18} />
							{t("activity.view")}
						</Button>
						{tooLong && <p className="w-full text-xs text-error">{t("activity.max24h")}</p>}
						{!tooLong && dataStartsLate && (
							<p className="w-full text-xs text-text-secondary">{t("activity.dataFrom", { time: dataStartsLate })}</p>
						)}
					</>
				}
			/>

			{points.length > 0 && (
				<div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
					<StatCard
						title={t("activity.points")}
						value={fmtNumber(points.length)}
						icon="solar:map-point-linear"
						tone="info"
					/>
					<StatCard
						title={t("activity.distance")}
						value={`${fmtNumber(stats.dist, 1)} km`}
						icon="solar:routing-2-linear"
						tone="primary"
					/>
					<StatCard
						title={t("activity.maxSpeed")}
						value={`${fmtNumber(stats.max)} km/h`}
						icon="solar:speedometer-max-linear"
						tone="warning"
					/>
					<StatCard
						title={t("activity.duration")}
						value={`${Math.floor(stats.dur / 3600)}h ${Math.floor((stats.dur % 3600) / 60)}m`}
						icon="solar:clock-circle-linear"
						tone="success"
					/>
				</div>
			)}

			<Card className="relative gap-0 overflow-hidden py-0">
				<div className="h-[calc(100vh-420px)] min-h-[420px]">
					<BaseMap zoom={12}>
						{path.length > 1 && (
							<>
								{/* Viền trắng + màu tím đậm: tách hẳn khỏi đường phố cam / vàng của nền bản đồ. */}
								<Polyline positions={path} pathOptions={{ color: "#fff", weight: 10, opacity: 0.9 }} />
								<Polyline positions={path} pathOptions={{ color: "#6D28D9", weight: 5, opacity: 0.9 }} />
								<Polyline positions={played} pathOptions={{ color: "#fff", weight: 11, opacity: 1 }} />
								<Polyline positions={played} pathOptions={{ color: "#0369A1", weight: 6, opacity: 1 }} />
								<CircleMarker
									center={path[0]}
									radius={10}
									pathOptions={{ color: "#fff", fillColor: "#16A34A", fillOpacity: 1, weight: 4 }}
								>
									<Tooltip>{t("activity.start")}</Tooltip>
								</CircleMarker>
								<CircleMarker
									center={path[path.length - 1]}
									radius={10}
									pathOptions={{ color: "#fff", fillColor: "#DC2626", fillOpacity: 1, weight: 4 }}
								>
									<Tooltip>{t("activity.end")}</Tooltip>
								</CircleMarker>
								<FitRoute points={points} />
							</>
						)}
						{current && (
							<Marker position={[current.lat, current.lng]} icon={vehicleIcon("ready")} zIndexOffset={1000} />
						)}
						<MapControls className={points.length > 1 ? "right-3 bottom-24" : undefined} />
					</BaseMap>
				</div>

				{query && !history.isFetching && points.length === 0 && (
					<div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/70">
						<EmptyState text={t("activity.noData")} icon="solar:map-point-remove-bold-duotone" />
					</div>
				)}

				{points.length > 1 && (
					<div className="absolute inset-x-3 bottom-3 z-[500] flex flex-wrap items-center gap-3 rounded-xl border bg-background/95 px-4 py-2 shadow-md backdrop-blur sm:inset-x-6">
						<Button
							size="icon"
							onClick={() => {
								if (index >= points.length - 1) setIndex(0);
								setPlaying((p) => index >= points.length - 1 || !p);
							}}
						>
							<Icon icon={playing ? "solar:pause-bold" : "solar:play-bold"} size={18} />
						</Button>
						<Slider
							className="min-w-[160px] flex-1"
							min={0}
							max={points.length - 1}
							value={index}
							onChange={(v) => {
								setPlaying(false);
								setIndex(v);
							}}
							tooltip={{ formatter: (v) => (v !== undefined ? dayjs.unix(points[v].ts).format("HH:mm:ss") : "") }}
						/>
						<Segmented
							size="small"
							value={speed}
							onChange={(v) => setSpeed(v as number)}
							options={SPEEDS.map((s) => ({ value: s, label: `${s}x` }))}
						/>
						{current && (
							<div className="flex items-center gap-3 text-xs text-text-secondary">
								<span className="flex items-center gap-1">
									<Icon icon="solar:clock-circle-linear" size={14} />
									{dayjs.unix(current.ts).format("DD/MM HH:mm:ss")}
								</span>
								<span className="flex items-center gap-1">
									<Icon icon="solar:speedometer-middle-linear" size={14} />
									{fmtNumber(current.speed ?? 0)} km/h
								</span>
							</div>
						)}
					</div>
				)}
			</Card>
		</>
	);
}
