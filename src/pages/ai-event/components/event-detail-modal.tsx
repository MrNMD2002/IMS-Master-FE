import { useQuery } from "@tanstack/react-query";
import { Descriptions, Modal, Progress, Skeleton, Switch, Table, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { AiEvent, AiObject } from "#/vigil";
import aiStationService from "@/api/services/aiStationService";
import { Icon } from "@/components/icon";
import { fmtDateTime, fmtDuration, fmtFromNow } from "@/utils/format";
import EventImage from "./event-image";
import {
	classColor,
	classLabel,
	EventHighlight,
	EventTypeTag,
	eventMeta,
	PlateText,
	pluginLabel,
	useClassLabel,
} from "./event-meta";

const fmtExtra = (v: unknown): string => {
	if (v === null || v === undefined) return "—";
	if (Array.isArray(v)) return v.map(fmtExtra).join(", ");
	if (typeof v === "number")
		return Number.isInteger(v) ? String(v) : v.toLocaleString(undefined, { maximumFractionDigits: 4 });
	if (typeof v === "object") return JSON.stringify(v);
	return String(v);
};

/** Chi tiết một sự kiện AI: ảnh lớn + khung nhận diện, độ tin cậy, đối tượng, `extra`. */
export default function EventDetailModal({ event, onClose }: { event: AiEvent | null; onClose: () => void }) {
	const { t } = useTranslation();
	const label = useClassLabel();
	const [showBoxes, setShowBoxes] = useState(true);

	// Lấy lại chi tiết để có `image_url` ký mới (link MinIO có hạn).
	const { data, isLoading } = useQuery({
		queryKey: ["ai-event", "detail", event?.event_id],
		queryFn: () => aiStationService.getEvent(event?.event_id as string),
		enabled: !!event,
		staleTime: 60_000,
	});
	const e = data ?? event;
	// fmtDateTime nhận số = giây epoch.
	const wallS = e ? e.captured_at.wall_us / 1e6 : 0;
	const latency = e ? Math.max(0, Math.round((e.sent_at - e.captured_at.wall_us) / 1000)) : 0;
	const extra = Object.entries(e?.extra ?? {});
	/** Định dạng giá trị `extra` theo khoá: giây → thời lượng, điểm → %, biển số → tấm biển. */
	const renderExtra = (k: string, v: unknown) => {
		if (k === "vehicle_class" && typeof v === "string") return classLabel(t, v);
		if ((k === "parked_secs" || k === "sustained_secs") && typeof v === "number") return fmtDuration(v, t);
		if (k === "max_score" && typeof v === "number") return `${Math.round(v * 100)}%`;
		if (k === "plate_text" && typeof v === "string") return <PlateText plate={v} />;
		return fmtExtra(v);
	};

	return (
		<Modal
			open={!!event}
			onCancel={onClose}
			footer={null}
			width={1120}
			centered
			title={
				e && (
					<span className="flex flex-wrap items-center gap-2">
						<Icon icon={eventMeta(e.event_type).icon} size={22} style={{ color: eventMeta(e.event_type).color }} />
						{t("aiEvent.detailTitle")}
						<EventTypeTag type={e.event_type} />
					</span>
				)
			}
		>
			{e && (
				<div className="grid grid-cols-1 gap-5 pt-2 lg:grid-cols-[minmax(0,1fr)_340px]">
					<div className="flex flex-col gap-3">
						{isLoading && !e.image_url ? (
							<Skeleton.Image active className="!aspect-video !h-auto !w-full" />
						) : (
							<EventImage
								src={e.image_url}
								objects={e.objects}
								showBoxes={showBoxes}
								alt={`${e.camera_name} — ${fmtDateTime(wallS, "DD/MM/YYYY HH:mm:ss")}`}
							/>
						)}
						<div className="flex flex-wrap items-center justify-between gap-2 text-sm">
							<span className="inline-flex items-center gap-2">
								<Switch id="ai-event-boxes" size="small" checked={showBoxes} onChange={setShowBoxes} />
								<label htmlFor="ai-event-boxes" className="cursor-pointer">
									{t("aiEvent.showBoxes")}
								</label>
							</span>
							{e.image_url && !e.image_url.startsWith("data:") && (
								<a
									href={e.image_url}
									target="_blank"
									rel="noreferrer"
									className="inline-flex items-center gap-1 text-primary"
								>
									<Icon icon="solar:square-top-down-linear" size={16} />
									{t("aiEvent.openImage")}
								</a>
							)}
						</div>
						<Table<AiObject>
							size="small"
							rowKey={(o, i) => `${o.track_id ?? "x"}-${i}`}
							pagination={false}
							dataSource={e.objects}
							locale={{ emptyText: t("aiEvent.noObjects") }}
							columns={[
								{
									title: t("aiEvent.field.object"),
									dataIndex: "class",
									render: (c: string) => (
										<span className="inline-flex items-center gap-2">
											<span className="h-3 w-3 rounded-sm" style={{ background: classColor(c) }} />
											{label(c)}
										</span>
									),
								},
								{ title: "Track", dataIndex: "track_id", render: (v) => (v == null ? "—" : `#${v}`) },
								{
									title: t("aiEvent.field.score"),
									dataIndex: "score",
									render: (s: number) => `${Math.round(s * 100)}%`,
								},
								{
									title: "bbox (x, y, w, h)",
									dataIndex: "bbox",
									render: (b: AiObject["bbox"]) => (
										<span className="font-mono text-xs">
											{[b.x, b.y, b.w, b.h].map((n) => n.toFixed(3)).join(", ")}
										</span>
									),
								},
							]}
						/>
					</div>

					<div className="flex flex-col gap-4">
						<EventHighlight event={e} />
						<div className="rounded-xl border p-4">
							<p className="mb-1 text-sm text-text-secondary">{t("aiEvent.field.score")}</p>
							<div className="flex items-center gap-3">
								<span className="text-3xl font-bold tabular-nums">{Math.round(e.score * 100)}%</span>
								<Progress
									percent={Math.round(e.score * 100)}
									showInfo={false}
									strokeColor={eventMeta(e.event_type).color}
									className="m-0 flex-1"
								/>
							</div>
						</div>
						<Descriptions column={1} size="small" bordered>
							<Descriptions.Item label={t("aiEvent.field.time")}>
								<p>{fmtDateTime(wallS, "DD/MM/YYYY HH:mm:ss")}</p>
								<p className="text-xs text-text-secondary">{fmtFromNow(wallS)}</p>
							</Descriptions.Item>
							<Descriptions.Item label={t("aiEvent.field.station")}>
								<Link to={`/ai/stations/${e.station_id}`} className="text-primary hover:underline" onClick={onClose}>
									{e.station_name}
								</Link>
							</Descriptions.Item>
							<Descriptions.Item label={t("aiEvent.field.camera")}>
								{e.camera_name} <span className="text-xs text-text-secondary">#{e.camera_id}</span>
							</Descriptions.Item>
							{e.zone_name && <Descriptions.Item label={t("aiEvent.field.zone")}>{e.zone_name}</Descriptions.Item>}
							<Descriptions.Item label={t("aiEvent.field.plugin")}>
								{pluginLabel(t, e.plugin)}
								<p className="font-mono text-xs text-text-secondary">{e.plugin}</p>
							</Descriptions.Item>
							<Descriptions.Item label={t("aiEvent.field.latency")}>
								{t("aiEvent.ms", { n: latency })}
							</Descriptions.Item>
						</Descriptions>

						{extra.length > 0 && (
							<div>
								<p className="mb-2 font-semibold">{t("aiEvent.field.extra")}</p>
								<Descriptions column={1} size="small" bordered>
									{extra.map(([k, v]) => (
										<Descriptions.Item key={k} label={t(`aiEvent.extraKey.${k}`, { defaultValue: k })}>
											{renderExtra(k, v)}
										</Descriptions.Item>
									))}
								</Descriptions>
							</div>
						)}

						<Descriptions column={1} size="small" className="[&_.ant-descriptions-item-label]:!text-xs">
							<Descriptions.Item label={t("aiEvent.field.eventId")}>
								<Typography.Text copyable className="font-mono text-xs">
									{e.event_id}
								</Typography.Text>
							</Descriptions.Item>
							<Descriptions.Item label={t("aiEvent.field.frameKey")}>
								<span className="break-all font-mono text-xs">{e.evidence.frame_key ?? "—"}</span>
							</Descriptions.Item>
						</Descriptions>
					</div>
				</div>
			)}
		</Modal>
	);
}
