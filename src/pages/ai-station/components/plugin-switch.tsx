import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch, Tag, Tooltip } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { AiStation, PluginInfo } from "#/vigil";
import aiStationService from "@/api/services/aiStationService";

/**
 * Công tắc chung của một plugin trên trạm — đồng bộ hai chiều với nút Bật/Tắt ở trang Plugin của
 * Vigil: CMC gửi lệnh `plugin_settings {name, enabled}`, trạm lưu rồi gửi lại danh sách plugin.
 * Plugin trạm chưa có model → không bật được, hiện nhãn "Chưa có model" kèm tên tệp còn thiếu.
 */
export default function PluginSwitch({
	station,
	plugin,
	canManage,
}: {
	station: AiStation;
	plugin: PluginInfo;
	canManage: boolean;
}) {
	const { t } = useTranslation();
	const qc = useQueryClient();
	/** Trạng thái người vừa bấm — hiện ngay, tới khi trạm gửi về khớp. */
	const [want, setWant] = useState<boolean | null>(null);
	const refresh = () => qc.invalidateQueries({ queryKey: ["ai-station", "detail", station.id] });
	const send = useMutation({
		mutationFn: (enabled: boolean) =>
			aiStationService.sendCommand(station.id, { cmd: "plugin_settings", args: { name: plugin.name, enabled } }),
		onSuccess: (c, enabled) => {
			const name = plugin.display_name;
			if (c.status === "ok") {
				toast.success(t(enabled ? "aiStation.plugin.turnedOn" : "aiStation.plugin.turnedOff", { name }));
			} else if (c.status === "timeout") {
				toast.warning(t("aiStation.plugin.timeout", { name }));
			} else {
				toast.error(t("aiStation.command.failed", { what: name, error: c.error ?? "" }));
				setWant(null);
			}
			// Trạm trả lời lệnh trước khi gửi lại danh sách plugin — tải lại thêm vài nhịp.
			refresh();
			for (const ms of [800, 2000, 4500]) setTimeout(refresh, ms);
			qc.invalidateQueries({ queryKey: ["ai-station", "commands", station.id] });
		},
		onError: () => setWant(null),
	});

	useEffect(() => {
		if (want === null) return;
		if (plugin.enabled === want) {
			setWant(null);
			return;
		}
		const id = setTimeout(() => setWant(null), 15_000);
		return () => clearTimeout(id);
	}, [want, plugin.enabled]);

	const missing = plugin.missing_models ?? [];
	const noModel = missing.length > 0;
	const checked = noModel ? false : (want ?? plugin.enabled);
	const locked = !station.online || !canManage || noModel;
	const why = noModel
		? t("aiStation.plugin.noModelHint", { files: missing.join(", ") })
		: !canManage
			? t("aiStation.command.noPermission")
			: !station.online
				? t("aiStation.command.offline")
				: checked
					? t("aiStation.plugin.turnOff")
					: t("aiStation.plugin.turnOn");

	return (
		<div className="flex items-center gap-2">
			<Tooltip title={why}>
				<Switch
					size="small"
					checked={checked}
					disabled={locked || send.isPending}
					loading={send.isPending}
					onChange={(on) => {
						setWant(on);
						send.mutate(on);
					}}
				/>
			</Tooltip>
			{noModel ? (
				<Tooltip title={why}>
					<Tag color="error" className="m-0">
						{t("aiStation.plugin.noModel")}
					</Tag>
				</Tooltip>
			) : checked ? (
				<Tag color={plugin.in_use === false ? "default" : "success"} className="m-0">
					{plugin.in_use === false ? t("aiStation.plugin.onIdle") : t("aiStation.plugin.on")}
				</Tag>
			) : (
				<Tag className="m-0">{t("aiStation.plugin.off")}</Tag>
			)}
		</div>
	);
}
