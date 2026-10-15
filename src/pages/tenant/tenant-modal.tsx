import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, Input, InputNumber, Modal, Switch } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Tenant, TenantReq } from "#/ims";
import tenantService from "@/api/services/tenantService";
import AddressSearch from "@/components/ims/address-search";
import LocationPicker from "@/components/ims/location-picker";
import TenantSelect from "@/components/ims/tenant-select";
import { P } from "@/constants/permission";
import { useCan, useUserInfo } from "@/store/userStore";

/** `{}` = tạo tổ chức gốc · `{parent}` = tạo đơn vị con · `{tenant}` = sửa · `null` = đóng. */
export type TenantModalState = { tenant?: Tenant; parent?: Tenant } | null;

const CODE_RE = /^[A-Za-z0-9_-]+$/;

export default function TenantModal({ state, onClose }: { state: TenantModalState; onClose: () => void }) {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const can = useCan();
	const { tenant_id } = useUserInfo();
	const [form] = Form.useForm<TenantReq>();
	const open = state !== null;
	const tenant = state?.tenant;
	const isEdit = !!tenant;
	const canMove = can(P.TENANT_SUBTREE_MANAGE, P.TENANT_MANAGE, P.PLATFORM_BYPASS);
	const selfOnly = isEdit && !canMove && tenant.id === tenant_id;
	// Trụ sở: ghim trên bản đồ / tìm địa chỉ — đồng bộ với 2 ô vĩ độ, kinh độ bên dưới.
	const lat = Form.useWatch("latitude", form);
	const lng = Form.useWatch("longitude", form);
	const pickHq = (la: number, ln: number, address?: string) => {
		form.setFieldsValue({ latitude: Number(la.toFixed(6)), longitude: Number(ln.toFixed(6)) });
		if (address && !form.getFieldValue("address_detail")) form.setFieldValue("address_detail", address);
	};

	useEffect(() => {
		if (!open) return;
		form.resetFields();
		if (tenant) {
			form.setFieldsValue({
				...tenant,
				latitude: tenant.latitude ? Number(tenant.latitude) : null,
				longitude: tenant.longitude ? Number(tenant.longitude) : null,
			});
		} else {
			form.setFieldsValue({ is_active: true, parent_tenant_id: state?.parent?.id ?? null });
		}
	}, [open, tenant, state, form]);

	const save = useMutation({
		mutationFn: (v: TenantReq) => {
			if (!isEdit) return tenantService.create(v);
			const { code: _code, ...rest } = v;
			// Không gửi parent khi không đổi (có mặt = chuyển node).
			if (rest.parent_tenant_id === (tenant.parent_tenant_id ?? null) || !canMove) delete rest.parent_tenant_id;
			// Chỉ có tenant.self_config (vd chỉ huy phường): sửa đơn vị mình qua /tenant/me/update,
			// không đổi được trạng thái khoá.
			if (selfOnly) {
				const { is_active: _a, parent_tenant_id: _p, ...own } = rest;
				return tenantService.updateMine(own);
			}
			return tenantService.update(tenant.id, rest);
		},
		onSuccess: () => {
			toast.success(isEdit ? t("common.saved") : t("tenant.created"));
			qc.invalidateQueries({ queryKey: ["tenant"] });
			qc.invalidateQueries({ queryKey: ["tenant-options"] });
			onClose();
		},
	});

	const title = isEdit
		? t("tenant.edit")
		: state?.parent
			? t("tenant.addChildOf", { name: state.parent.name })
			: t("tenant.createRoot");

	return (
		<Modal
			open={open}
			onCancel={onClose}
			title={title}
			okText={t("common.saveText")}
			cancelText={t("common.cancelText")}
			okButtonProps={{ loading: save.isPending }}
			onOk={() => form.validateFields().then((v) => save.mutate(v))}
			width={600}
			destroyOnHidden
		>
			<Form form={form} layout="vertical" requiredMark="optional" className="mt-2">
				<div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[1fr_200px]">
					<Form.Item
						name="name"
						label={t("tenant.field.name")}
						rules={[{ required: true, whitespace: true, message: t("validation.required") }]}
					>
						<Input />
					</Form.Item>
					<Form.Item
						name="code"
						label={t("tenant.field.code")}
						tooltip={t("tenant.codeTip")}
						rules={[
							{ required: !isEdit, message: t("validation.required") },
							{ pattern: CODE_RE, message: t("validation.code") },
						]}
					>
						<Input className="font-mono" disabled={isEdit} maxLength={50} />
					</Form.Item>
				</div>
				{(state?.parent || (isEdit && tenant?.parent_tenant_id && canMove)) && (
					<Form.Item name="parent_tenant_id" label={t("tenant.field.parent")}>
						<TenantSelect allowClear={false} style={{ width: "100%" }} disabled={!!state?.parent} />
					</Form.Item>
				)}
				<Form.Item name="description" label={t("common.descriptionLabel")}>
					<Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
				</Form.Item>
				<div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
					<Form.Item name="city" label={t("tenant.field.city")}>
						<Input maxLength={100} />
					</Form.Item>
					<Form.Item name="address_detail" label={t("tenant.field.address")}>
						<Input />
					</Form.Item>
					<Form.Item label={t("tenant.field.hq")} className="sm:col-span-2" extra={t("tenant.hqHint")}>
						<div className="flex flex-col gap-2">
							<AddressSearch onSelect={(r) => pickHq(r.lat, r.lng, r.label)} />
							<LocationPicker lat={lat} lng={lng} onChange={(la, ln) => pickHq(la, ln)} height={220} />
						</div>
					</Form.Item>
					<Form.Item name="latitude" label={t("tenant.field.lat")}>
						<InputNumber min={-90} max={90} step={0.000001} style={{ width: "100%" }} />
					</Form.Item>
					<Form.Item name="longitude" label={t("tenant.field.lng")}>
						<InputNumber min={-180} max={180} step={0.000001} style={{ width: "100%" }} />
					</Form.Item>
				</div>
				{/* Tổ chức mặc định (gốc nền tảng) không khoá được — backend trả 400. */}
				{!selfOnly && !tenant?.is_default && (
					<Form.Item
						name="is_active"
						label={t("common.statusLabel")}
						valuePropName="checked"
						tooltip={t("tenant.lockTip")}
					>
						<Switch checkedChildren={t("common.activeText")} unCheckedChildren={t("common.lockedText")} />
					</Form.Item>
				)}
			</Form>
		</Modal>
	);
}
