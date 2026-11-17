import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InputNumber, Tooltip } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { AiStation } from "#/vigil";
import aiStationService from "@/api/services/aiStationService";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";

const MIN_DAYS = 1;
const MAX_DAYS = 365;

/**
 * Số ngày giữ sự kiện của trạm — cài đặt chung của trạm, đồng bộ hai chiều với Vigil
 * (sửa ở Vigil thì CMC thấy, sửa ở đây thì trạm áp dụng). Trạm dọn bản sao cục bộ mỗi giờ,
 * CMC dọn sự kiện + ảnh của trạm này lúc 03:00 mỗi đêm theo cùng con số.
 */
export default function StationRetention({ station, canManage }: { station: AiStation; canManage: boolean }) {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const current = station.retention_days ?? 30;
	const [days, setDays] = useState<number | null>(current);
	useEffect(() => setDays(current), [current]);

	const save = useMutation({
		mutationFn: (v: number) =>
			aiStationService.sendCommand(station.id, { cmd: "station_settings", args: { retention_days: v } }),
		onSuccess: (c) => {
			if (c.status === "ok") toast.success(t("aiStation.retention.saved", { days }));
			else if (c.status === "timeout") toast.warning(t("aiStation.retention.timeout"));
			else toast.error(t("aiStation.retention.failed", { error: c.error ?? "" }));
			qc.invalidateQueries({ queryKey: ["ai-station", "detail", station.id] });
			qc.invalidateQueries({ queryKey: ["ai-station", "commands", station.id] });
		},
	});

	const locked = !canManage || !station.online;
	const why = !canManage ? t("aiStation.command.noPermission") : t("aiStation.command.offline");
	const dirty = days != null && days !== current;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-start gap-3">
				<Icon icon="solar:trash-bin-minimalistic-linear" size={20} className="mt-0.5 text-text-secondary" />
				<div className="flex-1">
					<div className="font-medium">{t("aiStation.retention.title")}</div>
					<div className="text-sm text-text-secondary">{t("aiStation.retention.hint")}</div>
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-2 pl-8">
				<Tooltip title={locked ? why : undefined}>
					<InputNumber
						min={MIN_DAYS}
						max={MAX_DAYS}
						precision={0}
						value={days}
						onChange={(v) => setDays(v)}
						disabled={locked || save.isPending}
						addonAfter={t("aiStation.retention.unit")}
						style={{ width: 160 }}
					/>
				</Tooltip>
				<Button
					size="sm"
					disabled={locked || !dirty || save.isPending}
					onClick={() => days != null && save.mutate(days)}
				>
					{t("common.saveText")}
				</Button>
				{dirty && !save.isPending && (
					<Button size="sm" variant="ghost" onClick={() => setDays(current)}>
						{t("common.cancelText")}
					</Button>
				)}
			</div>
			<div className="pl-8 text-xs text-text-secondary">{t("aiStation.retention.sync")}</div>
		</div>
	);
}
