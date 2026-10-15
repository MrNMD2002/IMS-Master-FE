import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Input, Modal } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { type Incident, isOnDuty } from "#/cmc";
import incidentService from "@/api/services/incidentService";
import { Icon } from "@/components/icon";
import NearbyVehicles from "./nearby-vehicles";

/** Điều thêm xe vào sự vụ — chọn từ danh sách xe gần hiện trường. */
export default function DispatchDialog({
	incident,
	open,
	onClose,
}: {
	incident: Incident | null;
	open: boolean;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const [ids, setIds] = useState<number[]>([]);
	const [note, setNote] = useState("");

	useEffect(() => {
		if (open) {
			setIds([]);
			setNote("");
		}
	}, [open]);

	const dispatch = useMutation({
		mutationFn: () => incidentService.dispatch(incident?.id as number, ids, note.trim()),
		onSuccess: () => {
			toast.success(t("dispatch.done", { count: ids.length }));
			qc.invalidateQueries({ queryKey: ["incident"] });
			qc.invalidateQueries({ queryKey: ["incident-detail"] });
			qc.invalidateQueries({ queryKey: ["incident-logs"] });
			qc.invalidateQueries({ queryKey: ["incident-active"] });
			qc.invalidateQueries({ queryKey: ["device-all"] });
			onClose();
		},
	});

	return (
		<Modal
			open={open}
			onCancel={onClose}
			title={
				<span className="flex items-center gap-2">
					<Icon icon="solar:bus-bold-duotone" size={22} className="text-primary" />
					{t("dispatch.title")}
				</span>
			}
			okText={t("dispatch.submit", { count: ids.length })}
			cancelText={t("common.cancelText")}
			okButtonProps={{ disabled: !ids.length, loading: dispatch.isPending }}
			onOk={() => dispatch.mutate()}
			width={560}
			destroyOnHidden
		>
			{incident && (
				<div className="flex flex-col gap-3">
					<div className="rounded-lg bg-secondary px-3 py-2 text-sm">
						<p className="font-semibold">{incident.name}</p>
						<p className="text-text-secondary text-xs">{incident.location_address || incident.location || "—"}</p>
					</div>
					<NearbyVehicles
						lat={incident.lat}
						lng={incident.lng}
						tenantId={incident.tenant_id}
						value={ids}
						onChange={setIds}
						excludeIds={incident.dispatched_devices.filter(isOnDuty).map((d) => d.device_id)}
					/>
					<Input.TextArea
						value={note}
						onChange={(e) => setNote(e.target.value)}
						maxLength={500}
						autoSize={{ minRows: 2, maxRows: 4 }}
						placeholder={t("dispatch.notePlaceholder")}
					/>
				</div>
			)}
		</Modal>
	);
}
