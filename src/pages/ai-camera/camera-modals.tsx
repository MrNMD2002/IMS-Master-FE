import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Checkbox, Form, Input, InputNumber, Modal, Popconfirm, Select, Switch, Tooltip } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { Camera, CameraChange, CameraInput, CameraPushResult } from "#/camera";
import aiStationService from "@/api/services/aiStationService";
import cameraService from "@/api/services/cameraService";
import TenantSelect from "@/components/cmc/tenant-select";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { cn } from "@/utils";
import { stationState } from "../ai-station/components/station-status";

/** Màu chấm trạng thái camera trên trạm. */
export const STATE_DOT: Record<string, string> = {
	live: "bg-success",
	connecting: "bg-warning",
	error: "bg-error",
	off: "bg-text-disabled",
};

/** Báo kết quả đẩy xuống từng trạm: lỗi trạm nào hiện trạm đó. */
export function reportPushed(pushed: CameraPushResult[], okText: string) {
	const failed = pushed.filter((p) => !p.ok);
	if (failed.length === 0) toast.success(okText);
	else for (const f of failed) toast.error(`${f.station_name ?? f.station_id}: ${f.error ?? ""}`, { duration: 8000 });
}

interface FormValues {
	name: string;
	source: string;
	location?: string;
	latitude?: number | null;
	longitude?: number | null;
	note?: string;
	tenant_id?: number | null;
}

/** Thêm (`camera` = null) / sửa camera. `undefined` = đóng. Đổi tên / nguồn thì CMC đẩy xuống các trạm đang gán. */
export function CameraFormModal({ camera, onClose }: { camera: Camera | null | undefined; onClose: () => void }) {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const [form] = Form.useForm<FormValues>();
	const open = camera !== undefined;
	const editing = !!camera;
	// Nguồn đầy đủ (có mật khẩu) chỉ lấy khi mở để sửa.
	const detail = useQuery({
		queryKey: ["camera", "detail", camera?.id],
		queryFn: () => cameraService.get(camera?.id ?? 0),
		enabled: !!camera,
		staleTime: 0,
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: nạp lại theo mã camera, không theo object
	useEffect(() => {
		if (!open) return;
		form.resetFields();
		if (camera) {
			form.setFieldsValue({
				name: camera.name,
				source: detail.data?.source_full ?? camera.source_full ?? "",
				location: camera.location ?? "",
				latitude: camera.latitude,
				longitude: camera.longitude,
				note: camera.note ?? "",
			});
		}
	}, [open, camera?.id, detail.data?.source_full, form]);

	const save = useMutation({
		mutationFn: async (v: FormValues): Promise<CameraChange | null> => {
			const body: Partial<CameraInput> = {
				name: v.name.trim(),
				source: v.source.trim(),
				location: v.location ?? "",
				latitude: v.latitude ?? null,
				longitude: v.longitude ?? null,
				note: v.note ?? "",
			};
			if (camera) return cameraService.update(camera.id, body);
			await cameraService.create({ ...(body as CameraInput), tenant_id: v.tenant_id ?? null });
			return null;
		},
		onSuccess: (r) => {
			qc.invalidateQueries({ queryKey: ["camera"] });
			if (r) reportPushed(r.pushed, t("aiCamera.updated"));
			else toast.success(t("aiCamera.created"));
			onClose();
		},
	});

	return (
		<Modal
			open={open}
			onCancel={onClose}
			title={editing ? t("aiCamera.form.editTitle") : t("aiCamera.form.createTitle")}
			okText={editing ? t("common.saveText") : t("aiCamera.form.createSubmit")}
			cancelText={t("common.cancelText")}
			confirmLoading={save.isPending}
			onOk={() => form.submit()}
			destroyOnHidden
			width={620}
		>
			<Form<FormValues> form={form} layout="vertical" onFinish={(v) => save.mutate(v)} className="pt-2">
				<Form.Item
					name="name"
					label={t("aiCamera.field.name")}
					rules={[{ required: true, whitespace: true, message: t("aiCamera.form.nameRequired") }, { max: 255 }]}
				>
					<Input placeholder={t("aiCamera.form.namePlaceholder")} autoFocus />
				</Form.Item>
				<Form.Item
					name="source"
					label={t("aiCamera.field.source")}
					extra={
						editing && (camera?.stations.length ?? 0) > 0
							? t("aiCamera.form.sourcePushHint")
							: t("aiCamera.form.sourceHint")
					}
					rules={[
						{ required: true, whitespace: true, message: t("aiCamera.form.sourceRequired") },
						{ pattern: /^(rtsps?|https?):\/\/\S+$/i, message: t("aiCamera.form.sourceInvalid") },
					]}
				>
					<Input className="font-mono" placeholder="rtsp://user:pass@192.168.1.10:554/stream1" />
				</Form.Item>
				<Form.Item name="location" label={t("aiCamera.field.location")} rules={[{ max: 255 }]}>
					<Input placeholder={t("aiCamera.form.locationPlaceholder")} />
				</Form.Item>
				<div className="grid grid-cols-2 gap-3">
					<Form.Item name="latitude" label={t("aiCamera.field.latitude")}>
						<InputNumber className="w-full" min={-90} max={90} step={0.000001} placeholder="21.0285" />
					</Form.Item>
					<Form.Item name="longitude" label={t("aiCamera.field.longitude")}>
						<InputNumber className="w-full" min={-180} max={180} step={0.000001} placeholder="105.8542" />
					</Form.Item>
				</div>
				<Form.Item name="note" label={t("aiCamera.field.note")} rules={[{ max: 2000 }]}>
					<Input.TextArea rows={2} />
				</Form.Item>
				{!editing && (
					<Form.Item name="tenant_id" label={t("aiStation.form.tenantLabel")} extra={t("aiCamera.form.tenantHint")}>
						<TenantSelect />
					</Form.Item>
				)}
			</Form>
		</Modal>
	);
}

/**
 * Trạm xử lý một camera: danh sách trạm đang chạy camera (gỡ từng trạm, có xác nhận) + gán thêm
 * trạm (chọn trạm đang kết nối và chức năng AI). Đọc lại camera sau mỗi thao tác để luôn đúng.
 */
export function StationsModal({
	cameraId,
	canManage,
	onClose,
}: {
	cameraId: number | null;
	canManage: boolean;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const navigate = useNavigate();
	const open = cameraId !== null;
	const [stationId, setStationId] = useState<string>();
	const [plugins, setPlugins] = useState<string[]>([]);
	const [enabled, setEnabled] = useState(true);

	// biome-ignore lint/correctness/useExhaustiveDependencies: làm mới khi mở camera khác
	useEffect(() => {
		setStationId(undefined);
		setPlugins([]);
		setEnabled(true);
	}, [cameraId]);

	const cam = useQuery({
		queryKey: ["camera", "detail", cameraId],
		queryFn: () => cameraService.get(cameraId ?? 0),
		enabled: open,
		refetchInterval: open ? 10_000 : false,
	});
	const camera = cam.data;
	const stations = useQuery({
		queryKey: ["ai-station", "list", "assign"],
		queryFn: () => aiStationService.listStations({ page: 1, page_size: 200 }),
		enabled: open && canManage,
	});
	const detail = useQuery({
		queryKey: ["ai-station", "detail", stationId],
		queryFn: () => aiStationService.getStation(stationId ?? ""),
		enabled: !!stationId,
	});

	const refresh = () => {
		qc.invalidateQueries({ queryKey: ["camera"] });
		qc.invalidateQueries({ queryKey: ["ai-station"] });
	};
	const unassign = useMutation({
		mutationFn: (station: string) => cameraService.unassign(cameraId ?? 0, station),
		onSuccess: (r) => {
			refresh();
			reportPushed(r.pushed, t("aiCamera.unassigned"));
		},
		onError: refresh,
	});
	const assign = useMutation({
		mutationFn: () =>
			cameraService.assign(cameraId ?? 0, {
				station_id: stationId ?? "",
				enabled,
				plugins: plugins.map((name) => ({ name, enabled: true, params: {} })),
			}),
		onSuccess: (r) => {
			refresh();
			reportPushed(r.pushed, t("aiCamera.assign.done"));
			if (r.pushed.every((p) => p.ok)) {
				setStationId(undefined);
				setPlugins([]);
			}
		},
		onError: refresh,
	});

	const linked = new Set(camera?.stations.map((s) => s.station_id));
	const options = (stations.data?.data ?? []).map((s) => {
		const state = stationState(s);
		return {
			value: s.id,
			disabled: state !== "online" || linked.has(s.id),
			label: (
				<span className="flex items-center justify-between gap-2">
					<span className="truncate">
						{s.name} <span className="font-mono text-xs text-text-secondary">{s.id}</span>
					</span>
					<span className="shrink-0 text-xs text-text-secondary">
						{linked.has(s.id)
							? t("aiCamera.assign.already")
							: state === "online"
								? t("aiCamera.assign.cams", { n: s.cameras_total })
								: state === "unpaired"
									? t("aiCamera.assign.unpaired")
									: t("aiCamera.assign.offline")}
					</span>
				</span>
			),
			search: `${s.name} ${s.id} ${s.location ?? ""}`,
		};
	});
	const pluginOpts = (detail.data?.plugins ?? []).map((p) => ({
		value: p.name,
		label: (
			<span>
				{p.display_name || p.name}
				{!p.enabled && <span className="ml-1 text-xs text-text-disabled">({t("aiStation.plugin.offOnStation")})</span>}
			</span>
		),
	}));
	const busyStation = unassign.isPending ? unassign.variables : undefined;

	return (
		<Modal
			open={open}
			onCancel={onClose}
			footer={null}
			title={t("aiCamera.stationsModal.title", { name: camera?.name ?? "" })}
			destroyOnHidden
			width={640}
		>
			<div className="flex flex-col gap-5 pt-2">
				<section className="flex flex-col gap-2">
					<h4 className="text-sm font-semibold">
						{t("aiCamera.stationsModal.current", { n: camera?.stations.length ?? 0 })}
					</h4>
					{cam.isLoading ? (
						<span className="text-sm text-text-secondary">{t("common.loadingText")}</span>
					) : camera?.stations.length ? (
						<ul className="flex flex-col divide-y divide-border rounded-lg border">
							{camera.stations.map((l) => (
								<li key={l.station_id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
									<span
										className={cn(
											"h-2.5 w-2.5 shrink-0 rounded-full",
											l.station_online ? (STATE_DOT[l.state ?? "off"] ?? STATE_DOT.off) : "bg-text-disabled",
										)}
									/>
									<div className="min-w-0 flex-1">
										<button
											type="button"
											className="truncate text-left font-medium hover:text-primary"
											onClick={() => navigate(`/ai/stations/${l.station_id}`)}
										>
											{l.station_name ?? l.station_id}
										</button>
										<p className="truncate text-xs text-text-secondary">
											{[
												l.station_online ? t("aiCamera.link.online") : t("aiCamera.link.offline"),
												l.remote_id === null ? t("aiCamera.link.pending") : null,
												l.enabled === false ? t("aiStation.live.cameraOff") : null,
												l.resolution ? `${l.resolution}${l.fps ? ` · ${l.fps} fps` : ""}` : null,
											]
												.filter(Boolean)
												.join(" · ")}
										</p>
										<p className="truncate text-xs text-text-secondary">
											{l.plugins.length ? l.plugins.join(", ") : t("aiStation.cam.noPlugin")}
										</p>
									</div>
									{canManage && (
										<Popconfirm
											title={t("aiCamera.stationsModal.unassignTitle", { station: l.station_name ?? l.station_id })}
											description={<span className="block max-w-xs">{t("aiCamera.stationsModal.unassignHint")}</span>}
											okText={t("aiCamera.stationsModal.unassign")}
											cancelText={t("common.cancelText")}
											okButtonProps={{ danger: true }}
											disabled={!l.station_online || unassign.isPending}
											onConfirm={() => unassign.mutateAsync(l.station_id).catch(() => {})}
										>
											<Tooltip title={l.station_online ? undefined : t("aiCamera.stationsModal.offlineHint")}>
												<Button
													variant="outline"
													size="sm"
													className="border-error/40 text-error hover:bg-error/10"
													disabled={!l.station_online || unassign.isPending}
												>
													<Icon
														icon={busyStation === l.station_id ? "svg-spinners:180-ring" : "solar:link-broken-linear"}
														size={16}
													/>
													{t("aiCamera.stationsModal.unassign")}
												</Button>
											</Tooltip>
										</Popconfirm>
									)}
								</li>
							))}
						</ul>
					) : (
						<p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-text-secondary">
							{t("aiCamera.stationsModal.none")}
						</p>
					)}
				</section>

				{canManage && (
					<section className="flex flex-col gap-3 border-t pt-4">
						<h4 className="text-sm font-semibold">{t("aiCamera.stationsModal.add")}</h4>
						<p className="text-xs text-text-secondary">{t("aiCamera.assign.hint")}</p>
						<Select
							showSearch
							value={stationId}
							onChange={(v) => {
								setStationId(v);
								setPlugins([]);
							}}
							loading={stations.isLoading}
							options={options}
							optionFilterProp="search"
							placeholder={t("aiCamera.assign.stationPlaceholder")}
						/>
						{stationId && (
							<div className="flex flex-col gap-1.5">
								<span className="text-sm font-medium">{t("aiCamera.assign.plugins")}</span>
								{detail.isLoading ? (
									<span className="text-sm text-text-secondary">{t("common.loadingText")}</span>
								) : pluginOpts.length ? (
									<Checkbox.Group
										className="flex flex-col gap-2"
										value={plugins}
										onChange={(v) => setPlugins(v as string[])}
										options={pluginOpts}
									/>
								) : (
									<span className="text-sm text-text-disabled">{t("aiCamera.assign.noPlugins")}</span>
								)}
								<span className="text-xs text-text-secondary">{t("aiCamera.assign.pluginsHint")}</span>
							</div>
						)}
						<div className="flex flex-wrap items-center justify-between gap-3">
							<span className="flex items-center gap-2 text-sm">
								<Switch
									size="small"
									checked={enabled}
									onChange={setEnabled}
									aria-label={t("aiCamera.assign.enabled")}
								/>
								{t("aiCamera.assign.enabled")}
							</span>
							<Button disabled={!stationId || assign.isPending} onClick={() => assign.mutate()}>
								<Icon icon={assign.isPending ? "svg-spinners:180-ring" : "solar:link-round-angle-linear"} size={16} />
								{t("aiCamera.assign.submit")}
							</Button>
						</div>
					</section>
				)}
			</div>
		</Modal>
	);
}
