import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, Switch, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { AiCommand, AiCommandName, AiStation, StationCamera } from "#/vigil";
import aiStationService from "@/api/services/aiStationService";
import EmptyState from "@/components/cmc/empty-state";
import { Icon } from "@/components/icon";
import { P } from "@/constants/permission";
import { useCan } from "@/store/userStore";
import { Button } from "@/ui/button";
import { fmtDateTime } from "@/utils/format";
import { useEventImage } from "../../ai-event/components/event-image";
import { LiveViewModal } from "./live-view";

const STATUS_COLOR: Record<AiCommand["status"], string> = {
	ok: "success",
	error: "error",
	timeout: "warning",
	pending: "processing",
};

/** Gửi lệnh + báo kết quả; dùng chung cho các nút trên một dòng camera. */
function useSendCommand(station: AiStation, onSnapshot: (c: AiCommand) => void, onFailed?: () => void) {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const refresh = () => qc.invalidateQueries({ queryKey: ["ai-station", "detail", station.id] });
	return useMutation({
		mutationFn: (v: { cmd: AiCommandName; camera: StationCamera }) =>
			aiStationService.sendCommand(station.id, { cmd: v.cmd, camera_id: v.camera.id }),
		onSuccess: (c, v) => {
			const what = t(`aiStation.command.name.${v.cmd}`);
			if (c.status === "ok") {
				toast.success(t("aiStation.command.done", { what, camera: v.camera.name }));
				if (c.cmd === "snapshot") onSnapshot(c);
			} else if (c.status === "timeout") {
				toast.warning(t("aiStation.command.timeout", { what, camera: v.camera.name }));
			} else {
				toast.error(t("aiStation.command.failed", { what, error: c.error ?? "" }));
				onFailed?.();
			}
			// Trạm trả lời lệnh TRƯỚC khi gửi lại danh sách camera (MQTT) — tải lại thêm vài
			// nhịp để trạng thái mới về tới trang mà không phải F5.
			refresh();
			for (const ms of [800, 2000, 4500]) setTimeout(refresh, ms);
			qc.invalidateQueries({ queryKey: ["ai-station", "commands", station.id] });
		},
		onError: () => onFailed?.(),
	});
}

/**
 * Cột điều khiển của một camera: công tắc bật/tắt + khởi động lại + chụp ảnh.
 * Trạm mất kết nối / không có quyền quản lý → khoá, có chú thích.
 */
export function CameraControls({
	station,
	camera,
	online,
	canManage,
}: {
	station: AiStation;
	camera: StationCamera;
	online: boolean;
	canManage: boolean;
}) {
	const { t } = useTranslation();
	const [snapshot, setSnapshot] = useState<AiCommand | null>(null);
	/** Trạng thái người vừa bấm — hiện ngay, tới khi dữ liệu trạm gửi về khớp. */
	const [want, setWant] = useState<boolean | null>(null);
	const [live, setLive] = useState(false);
	const send = useSendCommand(station, setSnapshot, () => setWant(null));
	useEffect(() => {
		if (want === null) return;
		if (camera.enabled === want) {
			setWant(null);
			return;
		}
		// Trạm không gửi về trạng thái mới (lỗi mạng…) → thôi giữ, theo dữ liệu thật.
		const id = setTimeout(() => setWant(null), 15_000);
		return () => clearTimeout(id);
	}, [want, camera.enabled]);
	const checked = want ?? camera.enabled;
	const busy = send.isPending ? send.variables?.cmd : undefined;
	const canLive = useCan()(P.CAMERA_LIVE_VIEW);
	const locked = !online || !canManage;
	const why = !canManage ? t("aiStation.command.noPermission") : t("aiStation.command.offline");
	const snapLocked = !online || !canLive;
	const snapWhy = !canLive ? t("aiStation.command.noPermission") : t("aiStation.command.offline");

	return (
		<div className="flex items-center gap-1.5">
			<Tooltip title={locked ? why : camera.enabled ? t("aiStation.command.turnOff") : t("aiStation.command.turnOn")}>
				<Switch
					size="small"
					checked={checked}
					disabled={locked || !!busy}
					loading={busy === "camera_enable" || busy === "camera_disable"}
					onChange={(on) => {
						setWant(on);
						send.mutate({ cmd: on ? "camera_enable" : "camera_disable", camera });
					}}
				/>
			</Tooltip>
			<Tooltip title={locked ? why : t("aiStation.command.name.camera_restart")}>
				<Button
					variant="ghost"
					size="icon"
					disabled={locked || !checked || !!busy}
					onClick={() => send.mutate({ cmd: "camera_restart", camera })}
					aria-label={t("aiStation.command.name.camera_restart")}
				>
					<Icon
						icon="solar:restart-linear"
						size={18}
						className={busy === "camera_restart" ? "animate-spin" : undefined}
					/>
				</Button>
			</Tooltip>
			<Tooltip title={snapLocked ? snapWhy : t("aiStation.command.name.snapshot")}>
				<Button
					variant="ghost"
					size="icon"
					disabled={snapLocked || !!busy}
					onClick={() => send.mutate({ cmd: "snapshot", camera })}
					aria-label={t("aiStation.command.name.snapshot")}
				>
					<Icon icon={busy === "snapshot" ? "svg-spinners:180-ring" : "solar:camera-linear"} size={18} />
				</Button>
			</Tooltip>
			<Tooltip
				title={
					!canLive
						? t("aiStation.command.noPermission")
						: !online
							? t("aiStation.command.offline")
							: !camera.enabled
								? t("aiStation.live.cameraOff")
								: t("aiStation.live.open")
				}
			>
				<Button
					variant="ghost"
					size="icon"
					disabled={!canLive || !online || !camera.enabled}
					onClick={() => setLive(true)}
					aria-label={t("aiStation.live.open")}
				>
					<Icon icon="solar:play-circle-linear" size={18} />
				</Button>
			</Tooltip>
			<SnapshotModal command={snapshot} onClose={() => setSnapshot(null)} />
			{live && <LiveViewModal station={station} camera={camera} open={live} onClose={() => setLive(false)} />}
		</div>
	);
}

/** Ảnh chụp theo lệnh — tải kèm token như ảnh sự kiện. */
export function SnapshotModal({ command, onClose }: { command: AiCommand | null; onClose: () => void }) {
	const { t } = useTranslation();
	const { url, failed, loading } = useEventImage(command?.image_url ?? null);
	const res = command?.result as { width?: number; height?: number } | undefined;
	return (
		<Modal
			open={!!command}
			onCancel={onClose}
			footer={null}
			width={880}
			title={
				command && (
					<span className="flex items-center gap-2">
						<Icon icon="solar:camera-bold-duotone" size={22} className="text-primary" />
						{t("aiStation.command.snapshotTitle", { camera: command.camera_name ?? `#${command.camera_id}` })}
					</span>
				)
			}
		>
			{command && (
				<div className="flex flex-col gap-2 pt-2">
					{loading && <div className="aspect-video w-full animate-pulse rounded-md bg-muted" />}
					{url && <img src={url} alt="" className="w-full rounded-md bg-black object-contain" />}
					{failed && <EmptyState text={t("aiStation.command.noImage")} />}
					<p className="text-xs text-text-secondary">
						{fmtDateTime(command.acked_at ?? command.created_at)}
						{res?.width && res?.height ? ` · ${res.width} × ${res.height}` : ""}
						{command.created_by_name ? ` · ${command.created_by_name}` : ""}
					</p>
				</div>
			)}
		</Modal>
	);
}

/** Tab "Lệnh điều khiển": ai gửi lệnh gì, lúc nào, trạm trả lời ra sao. */
export function CommandHistory({ stationId }: { stationId: string }) {
	const { t } = useTranslation();
	const [snapshot, setSnapshot] = useState<AiCommand | null>(null);
	const { data = [], isLoading } = useQuery({
		queryKey: ["ai-station", "commands", stationId],
		queryFn: () => aiStationService.listCommands(stationId),
		refetchInterval: 10_000,
	});

	const columns: ColumnsType<AiCommand> = [
		{
			title: t("aiStation.command.col.time"),
			dataIndex: "created_at",
			render: (v: string) => <span className="whitespace-nowrap text-sm">{fmtDateTime(v)}</span>,
		},
		{
			title: t("aiStation.command.col.command"),
			dataIndex: "cmd",
			render: (cmd: AiCommandName) => t(`aiStation.command.name.${cmd}`, { defaultValue: cmd }),
		},
		{
			title: t("aiStation.cam.name"),
			dataIndex: "camera_name",
			render: (v: string | null, c) => v ?? (c.camera_id != null ? `#${c.camera_id}` : "—"),
		},
		{
			title: t("aiStation.command.col.by"),
			dataIndex: "created_by_name",
			render: (v: string | null) => v ?? "—",
		},
		{
			title: t("aiStation.command.col.result"),
			dataIndex: "status",
			render: (s: AiCommand["status"], c) => (
				<div className="flex flex-col gap-0.5">
					<Tag className="m-0 w-fit" color={STATUS_COLOR[s]}>
						{t(`aiStation.command.status.${s}`)}
					</Tag>
					{c.error && s !== "ok" && <span className="max-w-[320px] text-xs text-text-secondary">{c.error}</span>}
				</div>
			),
		},
		{
			key: "image",
			render: (_, c) =>
				c.image_url ? (
					<Button variant="ghost" size="sm" onClick={() => setSnapshot(c)}>
						<Icon icon="solar:gallery-linear" size={16} />
						{t("aiStation.command.viewImage")}
					</Button>
				) : null,
		},
	];

	return (
		<>
			<Table<AiCommand>
				rowKey="id"
				size="middle"
				loading={isLoading}
				scroll={{ x: "max-content" }}
				pagination={false}
				columns={columns}
				dataSource={data}
				locale={{ emptyText: <EmptyState text={t("aiStation.command.empty")} /> }}
			/>
			<SnapshotModal command={snapshot} onClose={() => setSnapshot(null)} />
		</>
	);
}
