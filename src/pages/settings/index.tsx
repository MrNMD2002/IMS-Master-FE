import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Form, Input, InputNumber, Modal, Popconfirm, Switch, Table, Tabs } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { DeviceType, DeviceTypeReq } from "#/ims";
import deviceService from "@/api/services/deviceService";
import systemService from "@/api/services/systemService";
import { Icon } from "@/components/icon";
import PageHeader from "@/components/ims/page-header";
import { ActiveBadge } from "@/components/ims/status";
import { P } from "@/constants/permission";
import { useDeviceTypes } from "@/hooks/use-ims-options";
import { useCan } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { downloadBlob, fmtDateTime, fmtNumber } from "@/utils/format";

export default function SettingsPage() {
	const { t } = useTranslation();
	const can = useCan();
	const items = [
		...(can(P.DEVICE_READ) ? [{ key: "types", label: t("settings.deviceTypes"), children: <DeviceTypesTab /> }] : []),
		...(can(P.SETTING_READ) ? [{ key: "gps", label: t("settings.gpsRetention"), children: <GpsRetentionTab /> }] : []),
		...(can(P.SETTING_READ)
			? [{ key: "audit", label: t("settings.auditRetention.title"), children: <AuditRetentionTab /> }]
			: []),
	];
	return (
		<>
			<PageHeader
				icon="solar:settings-bold-duotone"
				title={t("sys.nav.settings")}
				description={t("settings.description")}
			/>
			<Card className="gap-0 py-2">
				<CardContent className="px-4 sm:px-6">
					<Tabs items={items} />
				</CardContent>
			</Card>
		</>
	);
}

function DeviceTypesTab() {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const can = useCan();
	// Danh mục loại phương tiện dùng chung — chỉ cấp nền tảng sửa được.
	const canManage = can(P.PLATFORM_BYPASS);
	const { types, isFetching } = useDeviceTypes();
	const [editing, setEditing] = useState<DeviceType | null | undefined>(undefined);

	const remove = useMutation({
		mutationFn: (id: number) => deviceService.typeRemove(id),
		onSuccess: () => {
			toast.success(t("common.deleted"));
			qc.invalidateQueries({ queryKey: ["device-types"] });
		},
	});

	const columns: ColumnsType<DeviceType> = [
		{ title: "#", dataIndex: "sort_order", width: 60 },
		{
			title: t("settings.typeName"),
			dataIndex: "name",
			render: (v, r) => (
				<span className="flex items-center gap-2">
					<Icon icon={r.icon?.includes(":") ? r.icon : "solar:bus-bold-duotone"} size={20} className="text-primary" />
					<span className="font-medium">{v}</span>
				</span>
			),
		},
		{ title: t("tenant.field.code"), dataIndex: "code", render: (v) => <span className="font-mono text-xs">{v}</span> },
		{ title: t("common.statusLabel"), dataIndex: "is_active", render: (v) => <ActiveBadge active={v} /> },
		...(canManage
			? [
					{
						key: "actions",
						align: "right" as const,
						render: (_: unknown, r: DeviceType) => (
							<div className="flex justify-end gap-1">
								<Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
									<Icon icon="solar:pen-linear" size={18} />
								</Button>
								<Popconfirm
									title={t("common.deleteConfirm")}
									okText={t("common.delText")}
									cancelText={t("common.cancelText")}
									okButtonProps={{ danger: true }}
									onConfirm={() => remove.mutateAsync(r.id)}
								>
									<Button size="icon" variant="ghost" className="text-error">
										<Icon icon="solar:trash-bin-trash-linear" size={18} />
									</Button>
								</Popconfirm>
							</div>
						),
					},
				]
			: []),
	];

	return (
		<div className="pb-4">
			<div className="mb-3 flex items-center justify-between gap-2">
				<p className="text-sm text-text-secondary">{t("settings.deviceTypesHint")}</p>
				{canManage && (
					<Button onClick={() => setEditing(null)}>
						<Icon icon="solar:add-circle-bold" size={18} />
						{t("settings.addType")}
					</Button>
				)}
			</div>
			<Table rowKey="id" size="middle" loading={isFetching} columns={columns} dataSource={types} pagination={false} />
			<DeviceTypeModal type={editing} onClose={() => setEditing(undefined)} />
		</div>
	);
}

function DeviceTypeModal({ type, onClose }: { type: DeviceType | null | undefined; onClose: () => void }) {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const [form] = Form.useForm<DeviceTypeReq>();
	const open = type !== undefined;
	const isEdit = !!type;

	useEffect(() => {
		if (!open) return;
		form.resetFields();
		form.setFieldsValue(type ?? { is_active: true, sort_order: 0 });
	}, [open, type, form]);

	const save = useMutation({
		mutationFn: (v: DeviceTypeReq) => {
			if (!isEdit) return deviceService.typeCreate(v);
			const { code: _c, ...rest } = v;
			return deviceService.typeUpdate(type.id, rest);
		},
		onSuccess: () => {
			toast.success(t("common.saved"));
			qc.invalidateQueries({ queryKey: ["device-types"] });
			onClose();
		},
	});

	return (
		<Modal
			open={open}
			onCancel={onClose}
			title={isEdit ? t("settings.editType") : t("settings.addType")}
			okText={t("common.saveText")}
			cancelText={t("common.cancelText")}
			okButtonProps={{ loading: save.isPending }}
			onOk={() => form.validateFields().then((v) => save.mutate(v))}
			destroyOnHidden
		>
			<Form form={form} layout="vertical" requiredMark="optional" className="mt-2">
				<Form.Item
					name="name"
					label={t("settings.typeName")}
					rules={[{ required: true, whitespace: true, message: t("validation.required") }]}
				>
					<Input />
				</Form.Item>
				<Form.Item
					name="code"
					label={t("tenant.field.code")}
					rules={[
						{ required: !isEdit, message: t("validation.required") },
						{ pattern: /^[A-Za-z0-9_-]+$/, message: t("validation.code") },
					]}
				>
					<Input className="font-mono" disabled={isEdit} />
				</Form.Item>
				<div className="grid grid-cols-2 gap-x-4">
					<Form.Item name="icon" label={t("settings.typeIcon")} tooltip={t("settings.typeIconTip")}>
						<Input placeholder="solar:bus-bold-duotone" />
					</Form.Item>
					<Form.Item name="sort_order" label={t("settings.sortOrder")}>
						<InputNumber min={0} style={{ width: "100%" }} />
					</Form.Item>
				</div>
				<Form.Item name="is_active" label={t("common.statusLabel")} valuePropName="checked">
					<Switch checkedChildren={t("common.activeText")} unCheckedChildren={t("common.inactiveText")} />
				</Form.Item>
			</Form>
		</Modal>
	);
}

function GpsRetentionTab() {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const can = useCan();
	const canManage = can(P.SETTING_MANAGE);
	const [form] = Form.useForm<{ enable_gps_cleanup: boolean; gps_retention_days: number }>();
	const { data, isLoading } = useQuery({ queryKey: ["gps-retention"], queryFn: systemService.gpsRetention });

	useEffect(() => {
		if (data) form.setFieldsValue(data);
	}, [data, form]);

	const save = useMutation({
		mutationFn: (v: { enable_gps_cleanup: boolean; gps_retention_days: number }) => systemService.updateGpsRetention(v),
		onSuccess: (r) => {
			if (r.in_sync) toast.success(t("settings.retentionSaved"));
			else toast.warning(t("settings.retentionNotSynced"));
			qc.invalidateQueries({ queryKey: ["gps-retention"] });
		},
	});
	const trigger = useMutation({
		mutationFn: systemService.triggerGpsCleanup,
		onSuccess: (r) => toast.success(t("settings.cleanupDone", { count: r.deleted })),
	});

	return (
		<div className="max-w-xl pb-4">
			{data && !data.in_sync && (
				<Alert
					className="mb-4"
					type="warning"
					showIcon
					message={t("settings.notSyncedTitle")}
					description={data.mongo_error || t("settings.notSyncedDesc")}
				/>
			)}
			<Form form={form} layout="vertical" disabled={!canManage || isLoading} onFinish={(v) => save.mutate(v)}>
				<Form.Item
					name="enable_gps_cleanup"
					label={t("settings.enableCleanup")}
					valuePropName="checked"
					extra={t("settings.enableCleanupHint")}
				>
					<Switch />
				</Form.Item>
				<Form.Item
					name="gps_retention_days"
					label={t("settings.retentionDays")}
					rules={[{ required: true, type: "number", min: 1, max: 3650, message: t("settings.retentionRange") }]}
				>
					<InputNumber min={1} max={3650} addonAfter={t("settings.days")} style={{ width: 220 }} />
				</Form.Item>
				{data && (
					<p className="mb-4 text-xs text-text-secondary">
						{t("settings.mongoTtl")}: {data.mongo_ttl_days ?? t("settings.noTtl")} · {t("common.updatedAt")}:{" "}
						{fmtDateTime(data.updated_at)}
					</p>
				)}
				{canManage && (
					<div className="flex gap-2">
						<Button type="submit" disabled={save.isPending}>
							<Icon icon="solar:check-circle-bold" size={18} />
							{t("common.saveText")}
						</Button>
						<Popconfirm
							title={t("settings.cleanupConfirm")}
							okText={t("common.confirmText")}
							cancelText={t("common.cancelText")}
							onConfirm={() => trigger.mutateAsync()}
						>
							<Button type="button" variant="outline" disabled={trigger.isPending}>
								<Icon icon="solar:broom-linear" size={18} />
								{t("settings.cleanupNow")}
							</Button>
						</Popconfirm>
					</div>
				)}
			</Form>
		</div>
	);
}

/**
 * Lưu trữ nhật ký thao tác — tương tự lịch sử GPS nhưng có MỨC TỐI THIỂU (365 ngày) và chỉ
 * dọn theo tuổi: nhật ký là bằng chứng ai làm gì nên không có xoá từng dòng / theo người.
 * Mọi lần đổi cấu hình / dọn đều được backend ghi lại vào chính nhật ký.
 */
function AuditRetentionTab() {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const can = useCan();
	const canManage = can(P.SETTING_MANAGE);
	const [form] = Form.useForm<{ enable_audit_cleanup: boolean; audit_retention_days: number }>();
	const { data, isLoading } = useQuery({ queryKey: ["audit-retention"], queryFn: systemService.auditRetention });
	const min = data?.min_days ?? 365;
	const max = data?.max_days ?? 3650;

	useEffect(() => {
		if (data) form.setFieldsValue(data);
	}, [data, form]);

	const refresh = () => qc.invalidateQueries({ queryKey: ["audit-retention"] });
	const save = useMutation({
		mutationFn: (v: { enable_audit_cleanup: boolean; audit_retention_days: number }) =>
			systemService.updateAuditRetention(v),
		onSuccess: () => {
			toast.success(t("settings.auditRetention.saved"));
			refresh();
		},
	});
	const exportXlsx = useMutation({
		mutationFn: systemService.exportExpiredAudit,
		onSuccess: ({ blob, filename }) => downloadBlob(blob, filename),
	});
	const trigger = useMutation({
		mutationFn: systemService.triggerAuditCleanup,
		onSuccess: (r) => {
			toast.success(t("settings.cleanupDone", { count: r.deleted }));
			refresh();
		},
	});

	const expired = data?.expired_rows ?? 0;

	return (
		<div className="max-w-2xl pb-4">
			<Alert className="mb-4" type="info" showIcon message={t("settings.auditRetention.policy", { min })} />
			{data && (
				<div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
					<Stat label={t("settings.auditRetention.total")} value={fmtNumber(data.total_rows)} />
					<Stat
						label={t("settings.auditRetention.expired")}
						value={fmtNumber(expired)}
						tone={expired > 0 ? "text-warning-dark dark:text-warning" : undefined}
					/>
					<Stat label={t("settings.auditRetention.oldest")} value={fmtDateTime(data.oldest_at, "DD/MM/YYYY")} />
					<Stat label={t("settings.auditRetention.cutoff")} value={fmtDateTime(data.cutoff, "DD/MM/YYYY")} />
				</div>
			)}
			<Form form={form} layout="vertical" disabled={!canManage || isLoading} onFinish={(v) => save.mutate(v)}>
				<Form.Item
					name="enable_audit_cleanup"
					label={t("settings.auditRetention.enable")}
					valuePropName="checked"
					extra={t("settings.auditRetention.enableHint")}
				>
					<Switch />
				</Form.Item>
				<Form.Item
					name="audit_retention_days"
					label={t("settings.retentionDays")}
					extra={t("settings.auditRetention.daysHint", { min, max })}
					rules={[
						{
							required: true,
							type: "number",
							min,
							max,
							message: t("settings.auditRetention.range", { min, max }),
						},
					]}
				>
					<InputNumber min={min} max={max} addonAfter={t("settings.days")} style={{ width: 220 }} />
				</Form.Item>
				{data && (
					<p className="mb-4 text-xs text-text-secondary">
						{t("common.updatedAt")}: {fmtDateTime(data.updated_at)}
					</p>
				)}
				{canManage && (
					<div className="flex flex-wrap gap-2">
						<Button type="submit" disabled={save.isPending}>
							<Icon icon="solar:check-circle-bold" size={18} />
							{t("common.saveText")}
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={exportXlsx.isPending || expired === 0}
							onClick={() => exportXlsx.mutate()}
							title={expired === 0 ? t("settings.auditRetention.nothingExpired") : undefined}
						>
							<Icon icon={exportXlsx.isPending ? "svg-spinners:180-ring" : "solar:file-download-bold"} size={18} />
							{t("settings.auditRetention.export", { count: expired })}
						</Button>
						<Popconfirm
							title={t("settings.auditRetention.cleanupConfirm", { count: expired })}
							description={t("settings.auditRetention.cleanupDesc")}
							okText={t("settings.cleanupNow")}
							okButtonProps={{ danger: true }}
							cancelText={t("common.cancelText")}
							onConfirm={() => trigger.mutateAsync()}
						>
							<Button type="button" variant="outline" disabled={trigger.isPending || expired === 0}>
								<Icon icon="solar:broom-linear" size={18} />
								{t("settings.cleanupNow")}
							</Button>
						</Popconfirm>
					</div>
				)}
			</Form>
		</div>
	);
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
	return (
		<div className="rounded-xl border px-3 py-2.5">
			<p className="text-xs text-text-secondary">{label}</p>
			<p className={`text-lg font-bold ${tone ?? ""}`}>{value}</p>
		</div>
	);
}
