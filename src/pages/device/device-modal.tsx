import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, Input, Modal, Select } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { DEVICE_STATUSES, type Device, type DeviceReq } from "#/ims";
import deviceService from "@/api/services/deviceService";
import TenantSelect from "@/components/ims/tenant-select";
import { useDeviceTypes } from "@/hooks/use-ims-options";
import { useUserInfo } from "@/store/userStore";

const IMEI_RE = /^[A-Za-z0-9_-]+$/;

/** `device === null` = tạo mới; `undefined` = đóng. */
export default function DeviceModal({ device, onClose }: { device: Device | null | undefined; onClose: () => void }) {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const { tenant_id } = useUserInfo();
	const { types } = useDeviceTypes();
	const [form] = Form.useForm<DeviceReq>();
	const open = device !== undefined;
	const isEdit = !!device;
	const locked = !!device?.is_mobilized;

	useEffect(() => {
		if (!open) return;
		form.resetFields();
		form.setFieldsValue(
			device
				? {
						name: device.name,
						imei: device.imei,
						device_type: device.device_type,
						status: device.status,
						tenant_id: device.tenant_id,
					}
				: { status: "ACTIVE", tenant_id, device_type: types[0]?.id },
		);
	}, [open, device, form, tenant_id, types]);

	const save = useMutation({
		mutationFn: (v: DeviceReq) => (isEdit ? deviceService.update(device.id, v) : deviceService.create(v)),
		onSuccess: () => {
			toast.success(isEdit ? t("common.saved") : t("device.created"));
			qc.invalidateQueries({ queryKey: ["device"] });
			qc.invalidateQueries({ queryKey: ["device-all"] });
			onClose();
		},
	});

	return (
		<Modal
			open={open}
			onCancel={onClose}
			title={isEdit ? t("device.edit") : t("device.create")}
			okText={t("common.saveText")}
			cancelText={t("common.cancelText")}
			okButtonProps={{ loading: save.isPending }}
			onOk={() => form.validateFields().then((v) => save.mutate(v))}
			destroyOnHidden
		>
			{locked && (
				<p className="mb-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-dark dark:text-warning">
					{t("device.lockedWhileMobilized")}
				</p>
			)}
			<Form form={form} layout="vertical" requiredMark="optional" className="mt-2">
				<Form.Item
					name="name"
					label={t("device.field.name")}
					rules={[{ required: true, whitespace: true, message: t("validation.required") }]}
				>
					<Input placeholder={t("device.namePlaceholder")} />
				</Form.Item>
				<Form.Item
					name="imei"
					label="IMEI"
					tooltip={t("device.imeiTip")}
					rules={[
						{ required: true, message: t("validation.required") },
						{ pattern: IMEI_RE, message: t("validation.code") },
					]}
				>
					<Input className="font-mono" disabled={locked} />
				</Form.Item>
				<div className="grid grid-cols-2 gap-x-4">
					<Form.Item
						name="device_type"
						label={t("device.field.type")}
						rules={[{ required: true, message: t("validation.required") }]}
					>
						<Select
							disabled={locked}
							options={types
								.filter((d) => d.is_active || d.id === device?.device_type)
								.map((d) => ({ value: d.id, label: d.name }))}
						/>
					</Form.Item>
					<Form.Item name="status" label={t("common.statusLabel")}>
						<Select
							disabled={locked}
							options={DEVICE_STATUSES.map((s) => ({ value: s, label: t(`device.status.${s}`) }))}
						/>
					</Form.Item>
				</div>
				<Form.Item name="tenant_id" label={t("device.field.tenant")}>
					<TenantSelect disabled={locked} style={{ width: "100%" }} />
				</Form.Item>
			</Form>
		</Modal>
	);
}
