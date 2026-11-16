import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, Input, Modal } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { AiStation, AiStationWithToken } from "#/vigil";
import aiStationService from "@/api/services/aiStationService";
import TenantSelect from "@/components/cmc/tenant-select";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";

interface FormValues {
	name: string;
	location?: string;
	tenant_id?: number | null;
}

/**
 * Tạo trạm (`station` = null) hoặc đổi tên / vị trí (`station` có giá trị).
 * `undefined` = đóng. Tạo xong gọi `onCreated` với mã ghép nối để mở hộp hiện mã.
 */
export function StationFormModal({
	station,
	onClose,
	onCreated,
}: {
	station: AiStation | null | undefined;
	onClose: () => void;
	onCreated?: (r: AiStationWithToken) => void;
}) {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const [form] = Form.useForm<FormValues>();
	const open = station !== undefined;
	const editing = !!station;

	// Chỉ nạp lại form khi mở / đổi trạm — trang chi tiết làm mới dữ liệu định kỳ, không được xoá chữ đang gõ.
	const stationKey = station?.id;
	// biome-ignore lint/correctness/useExhaustiveDependencies: theo mã trạm, không theo object
	useEffect(() => {
		if (!open) return;
		form.resetFields();
		if (station) form.setFieldsValue({ name: station.name, location: station.location ?? "" });
	}, [open, stationKey, form]);

	const save = useMutation({
		mutationFn: (v: FormValues) =>
			station
				? aiStationService.updateStation(station.id, { name: v.name, location: v.location ?? "" }).then(() => null)
				: aiStationService.createStation({ name: v.name, location: v.location, tenant_id: v.tenant_id ?? null }),
		onSuccess: (r) => {
			qc.invalidateQueries({ queryKey: ["ai-station"] });
			qc.invalidateQueries({ queryKey: ["ai-event"] });
			toast.success(editing ? t("aiStation.updated") : t("aiStation.created"));
			onClose();
			if (r) onCreated?.(r);
		},
	});

	return (
		<Modal
			open={open}
			onCancel={onClose}
			title={editing ? t("aiStation.form.editTitle") : t("aiStation.form.createTitle")}
			okText={editing ? t("common.saveText") : t("aiStation.form.createSubmit")}
			cancelText={t("common.cancelText")}
			confirmLoading={save.isPending}
			onOk={() => form.submit()}
			destroyOnHidden
		>
			<Form<FormValues> form={form} layout="vertical" onFinish={(v) => save.mutate(v)} className="pt-2">
				<Form.Item
					name="name"
					label={t("aiStation.field.name")}
					rules={[{ required: true, whitespace: true, message: t("aiStation.form.nameRequired") }, { max: 120 }]}
				>
					<Input placeholder={t("aiStation.form.namePlaceholder")} autoFocus />
				</Form.Item>
				<Form.Item name="location" label={t("aiStation.field.location")} rules={[{ max: 255 }]}>
					<Input placeholder={t("aiStation.form.locationPlaceholder")} />
				</Form.Item>
				{!editing && (
					<Form.Item name="tenant_id" label={t("aiStation.field.tenant")} extra={t("aiStation.form.tenantHint")}>
						<TenantSelect />
					</Form.Item>
				)}
			</Form>
		</Modal>
	);
}

/** Hiện mã ghép nối MỘT lần + hướng dẫn nhập vào Vigil. */
export function PairingTokenModal({ result, onClose }: { result: AiStationWithToken | null; onClose: () => void }) {
	const { t } = useTranslation();
	const server = window.location.origin;
	const copy = async (text: string, msg: string) => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(msg);
		} catch {
			toast.error(t("aiStation.token.copyFailed"));
		}
	};

	const steps = [t("aiStation.token.step1"), t("aiStation.token.step2", { server }), t("aiStation.token.step3")];

	return (
		<Modal
			open={!!result}
			onCancel={onClose}
			maskClosable={false}
			width={560}
			title={
				<span className="flex items-center gap-2">
					<Icon icon="solar:key-minimalistic-square-bold-duotone" size={22} className="text-primary" />
					{t("aiStation.token.title")}
				</span>
			}
			footer={<Button onClick={onClose}>{t("aiStation.token.done")}</Button>}
		>
			{result && (
				<div className="flex flex-col gap-4 pt-2">
					<p className="text-sm text-text-secondary">
						{t("aiStation.token.for")} <b className="text-text-primary">{result.station.name}</b>{" "}
						<span className="font-mono text-xs">({result.station.id})</span>
					</p>
					<div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4">
						<code className="flex-1 select-all break-all text-center font-mono text-xl font-bold tracking-wider sm:text-2xl">
							{result.pairing_token}
						</code>
						<Button onClick={() => copy(result.pairing_token, t("aiStation.token.copied"))}>
							<Icon icon="solar:copy-bold" size={18} />
							{t("aiStation.token.copy")}
						</Button>
					</div>
					<div className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning-dark dark:text-warning">
						<Icon icon="solar:danger-triangle-bold" size={18} className="mt-0.5 shrink-0" />
						<span>{t("aiStation.token.once")}</span>
					</div>
					<div>
						<p className="mb-2 font-semibold">{t("aiStation.token.stepsTitle")}</p>
						<ol className="m-0 flex list-none flex-col gap-2 p-0">
							{steps.map((s, i) => (
								<li key={i} className="flex items-start gap-3">
									<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
										{i + 1}
									</span>
									<span className="pt-0.5 text-sm">
										{s}
										{i === 1 && (
											<button
												type="button"
												className="ml-1 inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
												onClick={() => copy(server, t("aiStation.token.serverCopied"))}
											>
												<Icon icon="solar:copy-linear" size={14} />
												{t("aiStation.token.copyServer")}
											</button>
										)}
									</span>
								</li>
							))}
						</ol>
					</div>
				</div>
			)}
		</Modal>
	);
}
