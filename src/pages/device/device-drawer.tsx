import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Descriptions, Drawer, Popconfirm, Select, Typography } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Device } from "#/cmc";
import deviceService from "@/api/services/deviceService";
import userService from "@/api/services/userService";
import { DeviceStatusBadge, VehicleStateBadge } from "@/components/cmc/status";
import { Icon } from "@/components/icon";
import UserAvatar from "@/components/user-avatar";
import { P } from "@/constants/permission";
import { useVehicleSignal } from "@/hooks/use-vehicle-signal";
import { useCan } from "@/store/userStore";
import { Button } from "@/ui/button";

/** Chi tiết xe: thông tin, cán bộ được gán (mỗi cán bộ một xe), thông số MQTT. */
export default function DeviceDrawer({
	device,
	onClose,
	onEdit,
}: {
	device: Device | null;
	onClose: () => void;
	onEdit: (d: Device) => void;
}) {
	const { t } = useTranslation();
	const signal = useVehicleSignal();
	const qc = useQueryClient();
	const can = useCan();
	const canManage = can(P.DEVICE_MANAGE);
	const [userSearch, setUserSearch] = useState("");
	const id = device?.id;

	const detail = useQuery({
		queryKey: ["device", "detail", id],
		queryFn: () => deviceService.detail(id as number),
		enabled: !!id,
	});
	const users = useQuery({
		queryKey: ["device", "users", id],
		queryFn: () => deviceService.users(id as number),
		enabled: !!id,
	});
	const candidates = useQuery({
		queryKey: ["device", "candidates", userSearch, device?.tenant_id],
		queryFn: () => userService.list({ page_size: 20, search: userSearch || undefined, role: "gps_user" }),
		enabled: !!id && canManage && can(P.USER_READ),
	});

	const d = detail.data ?? device;

	const invalidate = () => {
		qc.invalidateQueries({ queryKey: ["device"] });
	};
	const assign = useMutation({
		mutationFn: (userId: number) => deviceService.assignUser(id as number, userId),
		onSuccess: () => {
			toast.success(t("device.officerAssigned"));
			invalidate();
		},
	});
	const unassign = useMutation({
		mutationFn: (userId: number) => deviceService.removeUser(id as number, userId),
		onSuccess: () => {
			toast.success(t("device.officerRemoved"));
			invalidate();
		},
	});
	const rotate = useMutation({
		mutationFn: () => deviceService.rotateKey(id as number),
		onSuccess: () => {
			toast.success(t("device.keyRotated"));
			invalidate();
		},
	});

	const assignedIds = new Set((users.data ?? []).map((u) => u.id));

	return (
		<Drawer
			open={!!device}
			onClose={onClose}
			width={520}
			title={
				<span className="flex items-center gap-2">
					<Icon icon="solar:bus-bold-duotone" size={22} className="text-primary" />
					{d?.name}
				</span>
			}
			extra={
				canManage &&
				d && (
					<Button size="sm" variant="outline" onClick={() => onEdit(d)}>
						<Icon icon="solar:pen-linear" size={16} />
						{t("common.editText")}
					</Button>
				)
			}
		>
			{d && (
				<div className="flex flex-col gap-6">
					<Descriptions column={1} size="small" bordered>
						<Descriptions.Item label="IMEI">
							<Typography.Text copyable className="font-mono">
								{d.imei}
							</Typography.Text>
						</Descriptions.Item>
						<Descriptions.Item label={t("device.field.type")}>{d.device_type_name || "—"}</Descriptions.Item>
						<Descriptions.Item label={t("device.field.tenant")}>{d.tenant_name || "—"}</Descriptions.Item>
						<Descriptions.Item label={t("common.statusLabel")}>
							<DeviceStatusBadge status={d.status} />
						</Descriptions.Item>
						<Descriptions.Item label={t("device.mission")}>
							<VehicleStateBadge device={d} signal={signal?.get(d.id) ?? null} />
						</Descriptions.Item>
					</Descriptions>

					<section>
						<h3 className="mb-2 flex items-center gap-2 font-semibold">
							<Icon icon="solar:user-id-bold-duotone" size={20} className="text-primary" />
							{t("device.officers")}
						</h3>
						<p className="mb-3 text-xs text-text-secondary">{t("device.officerHint")}</p>
						<div className="flex flex-col gap-2">
							{(users.data ?? []).length === 0 && <p className="text-sm text-text-disabled">{t("device.noOfficer")}</p>}
							{(users.data ?? []).map((u) => (
								<div key={u.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
									<UserAvatar name={u.full_name || u.username} size={32} />
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">{u.full_name || u.username}</p>
										<p className="text-xs text-text-secondary">@{u.username}</p>
									</div>
									{canManage && (
										<Popconfirm
											title={t("device.removeOfficerConfirm")}
											okText={t("common.confirmText")}
											cancelText={t("common.cancelText")}
											onConfirm={() => unassign.mutateAsync(u.id)}
										>
											<Button size="icon" variant="ghost" className="text-error">
												<Icon icon="solar:user-minus-linear" size={18} />
											</Button>
										</Popconfirm>
									)}
								</div>
							))}
							{canManage && can(P.USER_READ) && (
								<Select
									showSearch
									filterOption={false}
									onSearch={setUserSearch}
									placeholder={t("device.assignOfficer")}
									loading={candidates.isFetching || assign.isPending}
									value={null}
									onChange={(v) => v && assign.mutate(v)}
									options={(candidates.data?.data ?? [])
										.filter((u) => !assignedIds.has(u.id))
										.map((u) => ({
											value: u.id,
											label: `${u.full_name || u.username} (@${u.username})${u.device ? ` — ${u.device.name}` : ""}`,
										}))}
								/>
							)}
						</div>
					</section>

					<section>
						<h3 className="mb-2 flex items-center gap-2 font-semibold">
							<Icon icon="solar:server-square-bold-duotone" size={20} className="text-primary" />
							MQTT
						</h3>
						<Descriptions column={1} size="small" bordered>
							<Descriptions.Item label="mqtt_key">
								<Typography.Text copyable className="font-mono text-xs">
									{d.mqtt_key || "—"}
								</Typography.Text>
							</Descriptions.Item>
							<Descriptions.Item label="GPS topic">
								<Typography.Text copyable className="font-mono text-xs">
									{d.mqtt_gps_topic || "—"}
								</Typography.Text>
							</Descriptions.Item>
							<Descriptions.Item label="Dispatch topic">
								<Typography.Text copyable className="font-mono text-xs">
									{d.mqtt_dispatch_topic || "—"}
								</Typography.Text>
							</Descriptions.Item>
						</Descriptions>
						{canManage && (
							<Popconfirm
								title={t("device.rotateConfirm")}
								description={t("device.rotateDesc")}
								okText={t("common.confirmText")}
								cancelText={t("common.cancelText")}
								onConfirm={() => rotate.mutateAsync()}
							>
								<Button size="sm" variant="outline" className="mt-3">
									<Icon icon="solar:key-minimalistic-square-linear" size={16} />
									{t("device.rotateKey")}
								</Button>
							</Popconfirm>
						)}
					</section>
				</div>
			)}
		</Drawer>
	);
}
