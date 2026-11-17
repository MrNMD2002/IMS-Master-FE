import { Modal, Switch, Tooltip } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AiStation, StationCamera } from "#/vigil";
import aiStationService from "@/api/services/aiStationService";
import { Icon } from "@/components/icon";
import { GLOBAL_CONFIG } from "@/global-config";
import { Button } from "@/ui/button";
import { classColor, classLabel } from "../../ai-event/components/event-meta";

/**
 * Xem trực tiếp camera của trạm (hợp đồng `Vigil-Master/docs/cmc-contract.md` mục 5).
 *
 * Học từ hệ tham khảo (LL-HLS + hls.js `lowLatencyMode`), nhưng camera nằm sau mạng của trạm nên
 * không có máy chủ media kéo RTSP: trạm đẩy fMP4 H.264 lên CMC qua WebSocket, CMC chuyển nguyên
 * cho trình duyệt, trình duyệt nạp thẳng vào MSE — không cắt đoạn HLS, không playlist, trễ < 1 s.
 * Giữ trễ thấp: bộ đệm vượt ngưỡng thì nhảy tới gần cuối, hơi trễ thì phát nhanh 5 %. Khung nhận
 * diện AI (trạm gửi 4 lần/s) vẽ đè bằng canvas, như lớp phủ AI của hệ tham khảo.
 */

const KIND_INIT = 0;
/** Trễ (giây) tối đa trước khi nhảy hẳn tới cuối bộ đệm. */
const MAX_LAG = 1.5;
/** Trễ bắt đầu phát nhanh để đuổi kịp. */
const CATCH_UP_LAG = 0.6;
/** Bỏ dữ liệu đã phát cũ hơn (giây) để bộ nhớ không phình. */
const KEEP_BACK = 10;
/** Khung AI cũ hơn (ms) thì ẩn — trạm đã ngừng nhận diện. */
const BOX_TTL = 2000;

type Status = "connecting" | "playing" | "ended" | "error";

interface LiveBox {
	c: string;
	s: number;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

interface LiveInfo {
	codec: string;
	width: number;
	height: number;
	transcode?: boolean;
}

type MSCtor = typeof MediaSource;
const mediaSourceCtor = (): MSCtor | undefined =>
	(window as unknown as { ManagedMediaSource?: MSCtor }).ManagedMediaSource ?? window.MediaSource;

function wsUrl(path: string, ticket: string): string {
	const base = GLOBAL_CONFIG.apiBaseUrl.replace(/\/$/, "");
	const abs = /^https?:\/\//.test(base) ? base : `${window.location.origin}${base}`;
	return `${abs.replace(/^http/, "ws")}${path}?ticket=${encodeURIComponent(ticket)}`;
}

/** Nối luồng, nạp vào MSE, giữ trễ thấp. `attempt` đổi = nối lại. */
function useLivePlayer(stationId: string, cameraId: number, active: boolean, attempt: number) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const boxesRef = useRef<{ at: number; boxes: LiveBox[] }>({ at: 0, boxes: [] });
	const [status, setStatus] = useState<Status>("connecting");
	const [message, setMessage] = useState<string>();
	const [info, setInfo] = useState<LiveInfo>();
	const [lag, setLag] = useState<number>();

	useEffect(() => {
		if (!active) return;
		void attempt;
		let closed = false;
		let ws: WebSocket | undefined;
		let ms: MediaSource | undefined;
		let sb: SourceBuffer | undefined;
		let objectUrl: string | undefined;
		const queue: ArrayBuffer[] = [];
		setStatus("connecting");
		setMessage(undefined);
		setInfo(undefined);
		setLag(undefined);
		boxesRef.current = { at: 0, boxes: [] };

		const fail = (msg: string) => {
			if (closed) return;
			setStatus("error");
			setMessage(msg);
			ws?.close();
		};

		const pump = () => {
			const v = videoRef.current;
			if (!sb || sb.updating || !v) return;
			const b = sb.buffered;
			if (b.length && v.currentTime - b.start(0) > KEEP_BACK * 2) {
				sb.remove(b.start(0), v.currentTime - KEEP_BACK);
				return;
			}
			const next = queue.shift();
			if (!next) return;
			try {
				sb.appendBuffer(next);
			} catch (e) {
				if ((e as DOMException).name === "QuotaExceededError" && b.length) {
					queue.unshift(next);
					sb.remove(b.start(0), Math.max(b.start(0) + 0.1, v.currentTime - 2));
				} else fail(String(e));
			}
		};

		/** Giữ trễ thấp: nhảy tới gần cuối nếu quá trễ, hơi trễ thì phát nhanh. */
		const keepLive = () => {
			const v = videoRef.current;
			if (!sb || !v || !sb.buffered.length) return;
			const end = sb.buffered.end(sb.buffered.length - 1);
			const behind = end - v.currentTime;
			if (behind > MAX_LAG || v.currentTime < sb.buffered.start(0)) {
				v.currentTime = Math.max(sb.buffered.start(0), end - 0.2);
			}
			v.playbackRate = behind > CATCH_UP_LAG ? 1.05 : 1;
			setLag(Math.max(0, behind));
			if (v.paused) v.play().catch(() => {});
		};

		const openMedia = (codec: string) => {
			const Ctor = mediaSourceCtor();
			const mime = `video/mp4; codecs="${codec}"`;
			if (!Ctor || !Ctor.isTypeSupported(mime)) {
				fail("unsupported");
				return;
			}
			const v = videoRef.current;
			if (!v || ms) return;
			ms = new Ctor();
			v.disableRemotePlayback = true;
			objectUrl = URL.createObjectURL(ms);
			v.src = objectUrl;
			ms.addEventListener(
				"sourceopen",
				() => {
					if (!ms || closed) return;
					sb = ms.addSourceBuffer(mime);
					sb.addEventListener("updateend", () => {
						keepLive();
						pump();
					});
					pump();
				},
				{ once: true },
			);
		};

		aiStationService
			.liveTicket(stationId, cameraId)
			.then(({ ticket, ws_path }) => {
				if (closed) return;
				ws = new WebSocket(wsUrl(ws_path, ticket));
				ws.binaryType = "arraybuffer";
				ws.onmessage = (ev) => {
					if (typeof ev.data === "string") {
						let m: { t?: string; message?: string; boxes?: LiveBox[] } & Partial<LiveInfo>;
						try {
							m = JSON.parse(ev.data);
						} catch {
							return;
						}
						if (m.t === "codec" && m.codec) {
							setInfo({ codec: m.codec, width: m.width ?? 0, height: m.height ?? 0, transcode: m.transcode });
							openMedia(m.codec);
						} else if (m.t === "boxes") {
							boxesRef.current = { at: performance.now(), boxes: m.boxes ?? [] };
						} else if (m.t === "error") {
							fail(m.message ?? "error");
						} else if (m.t === "end") {
							if (!closed) setStatus((s) => (s === "error" ? s : "ended"));
						}
						return;
					}
					const data = ev.data as ArrayBuffer;
					if (data.byteLength < 2) return;
					const kind = new Uint8Array(data, 0, 1)[0];
					// Khởi tạo lặp lại (người xem chậm bị đồng bộ lại): bỏ hàng chờ cũ.
					if (kind === KIND_INIT) queue.length = 0;
					queue.push(data.slice(1));
					if (queue.length > 120) queue.splice(0, queue.length - 120);
					pump();
					setStatus((s) => (s === "connecting" && kind !== KIND_INIT ? "playing" : s));
				};
				ws.onclose = () => {
					if (!closed) setStatus((s) => (s === "error" ? s : "ended"));
				};
				ws.onerror = () => fail("network");
			})
			.catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));

		const timer = window.setInterval(keepLive, 500);
		return () => {
			closed = true;
			window.clearInterval(timer);
			ws?.close();
			const v = videoRef.current;
			if (v) {
				v.removeAttribute("src");
				v.load();
			}
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [stationId, cameraId, active, attempt]);

	return { videoRef, boxesRef, status, message, info, lag };
}

/** Vẽ khung AI theo đúng vùng ảnh hiển thị (video `object-contain`). */
function useOverlay(
	videoRef: React.RefObject<HTMLVideoElement | null>,
	canvasRef: React.RefObject<HTMLCanvasElement | null>,
	boxesRef: React.RefObject<{ at: number; boxes: LiveBox[] }>,
	enabled: boolean,
	label: (c: string) => string,
) {
	useEffect(() => {
		let raf = 0;
		let lastAt = -1;
		const draw = () => {
			raf = requestAnimationFrame(draw);
			const v = videoRef.current;
			const cv = canvasRef.current;
			if (!v || !cv) return;
			const dpr = window.devicePixelRatio || 1;
			const cw = v.clientWidth;
			const ch = v.clientHeight;
			const { at, boxes } = boxesRef.current;
			const fresh = enabled && performance.now() - at < BOX_TTL;
			const sizeChanged = cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr);
			if (!sizeChanged && at === lastAt && fresh) return;
			lastAt = at;
			cv.width = Math.round(cw * dpr);
			cv.height = Math.round(ch * dpr);
			const ctx = cv.getContext("2d");
			if (!ctx) return;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, cw, ch);
			if (!fresh || !v.videoWidth) return;
			const scale = Math.min(cw / v.videoWidth, ch / v.videoHeight);
			const w = v.videoWidth * scale;
			const h = v.videoHeight * scale;
			const ox = (cw - w) / 2;
			const oy = (ch - h) / 2;
			ctx.font = "600 12px system-ui, sans-serif";
			ctx.lineWidth = 2;
			for (const b of boxes) {
				const color = classColor(b.c);
				const x = ox + b.x1 * w;
				const y = oy + b.y1 * h;
				const bw = (b.x2 - b.x1) * w;
				const bh = (b.y2 - b.y1) * h;
				ctx.strokeStyle = color;
				ctx.strokeRect(x, y, bw, bh);
				const text = `${label(b.c)} ${Math.round(b.s * 100)}%`;
				const tw = ctx.measureText(text).width + 8;
				const ty = y > 18 ? y - 18 : y;
				ctx.fillStyle = color;
				ctx.fillRect(x - 1, ty, tw, 18);
				ctx.fillStyle = "#fff";
				ctx.fillText(text, x + 3, ty + 13);
			}
		};
		raf = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(raf);
	}, [videoRef, canvasRef, boxesRef, enabled, label]);
}

export function LiveViewModal({
	station,
	camera,
	open,
	onClose,
}: {
	station: Pick<AiStation, "id">;
	camera: Pick<StationCamera, "id" | "name">;
	open: boolean;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const [attempt, setAttempt] = useState(0);
	const [showBoxes, setShowBoxes] = useState(true);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const wrapRef = useRef<HTMLDivElement>(null);
	const { videoRef, boxesRef, status, message, info, lag } = useLivePlayer(station.id, camera.id, open, attempt);
	const label = useCallback((c: string) => classLabel(t, c), [t]);
	useOverlay(videoRef, canvasRef, boxesRef, showBoxes, label);

	const errorText =
		message === "unsupported"
			? t("aiStation.live.unsupported")
			: message === "network"
				? t("aiStation.live.network")
				: message;

	return (
		<Modal
			open={open}
			onCancel={onClose}
			footer={null}
			width={980}
			destroyOnHidden
			title={
				<span className="flex items-center gap-2">
					<span className="relative flex h-2.5 w-2.5">
						{status === "playing" && (
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-60" />
						)}
						<span
							className={`relative inline-flex h-2.5 w-2.5 rounded-full ${status === "playing" ? "bg-error" : "bg-text-disabled"}`}
						/>
					</span>
					{t("aiStation.live.title", { name: camera.name })}
				</span>
			}
		>
			<div ref={wrapRef} className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
				<video ref={videoRef} className="h-full w-full object-contain" muted autoPlay playsInline />
				<canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
				{status !== "playing" && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-white/85">
						{status === "connecting" && (
							<>
								<Icon icon="svg-spinners:180-ring" size={32} />
								<span className="text-sm">{t("aiStation.live.connecting")}</span>
							</>
						)}
						{(status === "error" || status === "ended") && (
							<>
								<Icon
									icon={status === "error" ? "solar:videocamera-record-broken" : "solar:stop-circle-linear"}
									size={32}
								/>
								<span className="max-w-md px-4 text-sm">
									{status === "error" ? errorText : t("aiStation.live.ended")}
								</span>
								{/* Nền video luôn đen: nút viền trắng, không theo màu chủ đề (bg-secondary sáng + chữ trắng thừa hưởng = không thấy chữ). */}
								<Button
									size="sm"
									variant="outline"
									className="border-white/60 bg-white/10 text-white shadow-none hover:bg-white/25 hover:text-white"
									onClick={() => setAttempt((a) => a + 1)}
								>
									<Icon icon="solar:restart-linear" size={16} />
									{t("aiStation.live.retry")}
								</Button>
							</>
						)}
					</div>
				)}
			</div>
			<div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-secondary">
				<span className="flex items-center gap-2">
					<Switch size="small" checked={showBoxes} onChange={setShowBoxes} aria-label={t("aiStation.live.boxes")} />
					{t("aiStation.live.boxes")}
				</span>
				{info && (
					<span>
						{info.width && info.height ? `${info.width}×${info.height} · ` : ""}H.264
						{info.transcode ? ` (${t("aiStation.live.transcoded")})` : ""}
					</span>
				)}
				{status === "playing" && lag !== undefined && (
					<Tooltip title={t("aiStation.live.lagHint")}>
						<span>{t("aiStation.live.lag", { s: lag.toFixed(1) })}</span>
					</Tooltip>
				)}
				<span className="ml-auto">{t("aiStation.live.hint")}</span>
			</div>
		</Modal>
	);
}
