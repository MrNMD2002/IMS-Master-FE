import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Dropdown, Input, Select, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { DEVICE_STATUSES, type Device } from "#/ims";
import deviceService from "@/api/services/deviceService";
import { Icon } from "@/components/icon";
import OrgUnitFilter from "@/components/ims/org-unit-filter";
import PageHeader from "@/components/ims/page-header";
import { DeviceStatusBadge, MobilizedBadge } from "@/components/ims/status";
import { P } from "@/constants/permission";
import { useDeviceTypes } from "@/hooks/use-ims-options";
import { useCan } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import DeviceDrawer from "./device-drawer";
import DeviceModal from "./device-modal";

export default function DevicePage() {
	const { t } = useTranslation();
	const { modal } = App.useApp();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const can = useCan();
	const canManage = can(P.DEVICE_MANAGE);
	const { types } = useDeviceTypes();

	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [search, setSearch] = useState("");
	const [keyword, setKeyword] = useState("");
	const [tenantId, setTenantId] = useState<number | undefined>();
	const [typeId, setTypeId] = useState<number | undefined>();
	const [status, setStatus] = useState<string | undefined>();
	const [mobilized, setMobilized] = useState<boolean | undefined>();

	const [editing, setEditing] = useState<Device | null | undefined>(undefined);
	const [viewing, setViewing] = useState<Device | null>(null);

	const { data, isFetching } = useQuery({
		queryKey: ["device", "list", page, pageSize, keyword, tenantId, typeId, status, mobilized],
		queryFn: () =>
			deviceService.list({
				page,
				page_size: pageSize,
				search: keyword || undefined,
				tenant_id: tenantId,
				device_type: typeId,
				status,
				is_mobilized: mobilized,
			}),
		placeholderData: keepPreviousData,
	});

	const remove = useMutation({
		mutationFn: (id: number) => deviceService.remove(id),
		onSuccess: () => {
			toast.success(t("common.deleted"));
			qc.invalidateQueries({ queryKey: ["device"] });
		},
	});

	const resetPage =
		<T,>(fn: (v: T) => void) =>
		(v: T) => {
			fn(v);
			setPage(1);
		};

	const columns: ColumnsType<Device> = [
		{
			title: t("device.field.name"),
			dataIndex: "name",
			render: (_, d) => (
				<button type="button" className="flex items-center gap-3 text-left" onClick={() => setViewing(d)}>
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
						<Icon icon="solar:bus-bold-duotone" size={20} />
					</span>
					<div>
						<p className="font-medium hover:text-primary">{d.name}</p>
						<p className="text-xs text-text-secondary font-mono">{d.imei}</p>
					</div>
				</button>
			),
		},
		{ title: t("device.field.type"), dataIndex: "device_type_name", render: (v) => v || "—" },
		{ title: t("device.field.tenant"), dataIndex: "tenant_name", render: (v) => v || "—" },
		{
			title: t("common.statusLabel"),
			dataIndex: "status",
			render: (s, d) => (
				<span className="flex flex-wrap items-center gap-1">
					<DeviceStatusBadge status={s} />
					{/* Xe "Hoạt động" nhưng loại bị khoá → không điều được; nêu rõ lý do. */}
					{s === "ACTIVE" && d.available === false && (
						<Tooltip title={d.unavailable_reason}>
							<Tag color="error" className="m-0">
								{t("device.typeLocked")}
							</Tag>
						</Tooltip>
					)}
				</span>
			),
		},
		{
			title: t("device.mission"),
			key: "mobilized",
			render: (_, d) =>
				d.is_mobilized && d.current_incident_id ? (
					<button type="button" onClick={() => navigate(`/incidents/${d.current_incident_id}`)}>
						<MobilizedBadge mobilized />
					</button>
				) : d.available === false ? (
					<Tooltip title={d.unavailable_reason}>
						<Tag color="error" className="m-0">
							{t("monitor.state.unavailable")}
						</Tag>
					</Tooltip>
				) : (
					<MobilizedBadge mobilized={d.is_mobilized} />
				),
		},
		{
			key: "actions",
			align: "right",
			width: 60,
			render: (_, d) => (
				<Dropdown
					trigger={["click"]}
					menu={{
						items: [
							{
								key: "view",
								icon: <Icon icon="solar:eye-linear" size={16} />,
								label: t("common.detail"),
								onClick: () => setViewing(d),
							},
							...(can(P.DEVICE_ACTIVITY_READ)
								? [
										{
											key: "replay",
											icon: <Icon icon="solar:route-linear" size={16} />,
											label: t("monitor.replay"),
											onClick: () => navigate(`/activity?device=${d.id}`),
										},
									]
								: []),
							...(canManage
								? [
										{
											key: "edit",
											icon: <Icon icon="solar:pen-linear" size={16} />,
											label: t("common.editText"),
											onClick: () => setEditing(d),
										},
										{ type: "divider" as const },
										{
											key: "delete",
											danger: true,
											icon: <Icon icon="solar:trash-bin-trash-linear" size={16} />,
											label: t("common.delText"),
											// Hộp xác nhận riêng: Popconfirm đặt trong menu Dropdown bị đóng theo menu nên không xoá được.
											onClick: () =>
												modal.confirm({
													title: t("device.deleteConfirm", { name: d.name }),
													okText: t("common.delText"),
													cancelText: t("common.cancelText"),
													okButtonProps: { danger: true },
													onOk: () => remove.mutateAsync(d.id),
												}),
										},
									]
								: []),
						],
					}}
				>
					<Button variant="ghost" size="icon">
						<Icon icon="solar:menu-dots-bold" size={18} />
					</Button>
				</Dropdown>
			),
		},
	];

	return (
		<>
			<PageHeader
				icon="solar:bus-bold-duotone"
				title={t("sys.nav.device")}
				description={t("device.description")}
				actions={
					canManage && (
						<Button onClick={() => setEditing(null)}>
							<Icon icon="solar:add-circle-bold" size={18} />
							{t("device.create")}
						</Button>
					)
				}
				toolbar={
					<>
						<Input.Search
							allowClear
							className="max-w-xs"
							placeholder={t("device.searchPlaceholder")}
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							onSearch={(v) => {
								setKeyword(v.trim());
								setPage(1);
							}}
						/>
						<OrgUnitFilter value={tenantId} onChange={resetPage(setTenantId)} />
						<Select
							allowClear
							style={{ minWidth: 150 }}
							placeholder={t("device.field.type")}
							value={typeId}
							onChange={resetPage(setTypeId)}
							options={types.map((d) => ({ value: d.id, label: d.name }))}
						/>
						<Select
							allowClear
							style={{ minWidth: 150 }}
							placeholder={t("common.statusLabel")}
							value={status}
							onChange={resetPage(setStatus)}
							options={DEVICE_STATUSES.map((s) => ({ value: s, label: t(`device.status.${s}`) }))}
						/>
						<Select
							allowClear
							style={{ minWidth: 150 }}
							placeholder={t("device.mission")}
							value={mobilized}
							onChange={resetPage(setMobilized)}
							options={[
								{ value: true, label: t("device.mobilized") },
								{ value: false, label: t("device.ready") },
							]}
						/>
					</>
				}
			/>
			<Card className="gap-0 py-5">
				<CardContent className="px-4 sm:px-6">
					<Table
						rowKey="id"
						size="middle"
						scroll={{ x: "max-content" }}
						loading={isFetching}
						columns={columns}
						dataSource={data?.data ?? []}
						pagination={{
							current: page,
							pageSize,
							total: data?.metadata.total_items ?? 0,
							showSizeChanger: true,
							showTotal: (total) => t("common.totalItems", { total }),
							onChange: (p, s) => {
								setPage(p);
								setPageSize(s);
							},
						}}
					/>
				</CardContent>
			</Card>

			<DeviceModal device={editing} onClose={() => setEditing(undefined)} />
			<DeviceDrawer device={viewing} onClose={() => setViewing(null)} onEdit={(d) => setEditing(d)} />
		</>
	);
}
