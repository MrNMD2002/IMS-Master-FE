import { useQuery } from "@tanstack/react-query";
import { DatePicker, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import type { AiEventQuery } from "#/vigil";
import aiStationService from "@/api/services/aiStationService";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { eventTypeLabel } from "../ai-event/components/event-meta";
import type { PluginPage } from "./plugins";

const { RangePicker } = DatePicker;
const DAY = "YYYY-MM-DD";

/**
 * Bộ lọc dùng chung cho trang Danh sách và Thống kê của một plugin. Lưu hết trên URL để chuyển
 * qua lại giữa hai trang (hoặc gửi link) vẫn giữ nguyên trạm / camera / khoảng ngày.
 */
export function usePluginFilters(plugin: PluginPage) {
	const { t } = useTranslation();
	const [params, setParams] = useSearchParams();
	const station = params.get("station") ?? undefined;
	const camera = params.get("camera") ? Number(params.get("camera")) : undefined;
	const type = params.get("type") ?? undefined;
	const from = dayjs(params.get("from") ?? "", DAY, true);
	const to = dayjs(params.get("to") ?? "", DAY, true);
	const range: [Dayjs, Dayjs] = [from.isValid() ? from : dayjs().subtract(6, "day"), to.isValid() ? to : dayjs()];

	const set = (patch: Record<string, string | undefined>) => {
		const next = new URLSearchParams(params);
		for (const [k, v] of Object.entries(patch)) {
			if (v) next.set(k, v);
			else next.delete(k);
		}
		setParams(next, { replace: true });
	};

	const stations = useQuery({
		queryKey: ["ai-station", "list", ""],
		queryFn: () => aiStationService.listStations({ page: 1, page_size: 200 }),
	});
	const stationDetail = useQuery({
		queryKey: ["ai-station", "detail", station],
		queryFn: () => aiStationService.getStation(station as string),
		enabled: !!station,
	});

	const fromIso = range[0].startOf("day").toISOString();
	const toIso = range[1].endOf("day").toISOString();
	const filters = useMemo<Omit<AiEventQuery, "page" | "page_size">>(
		() => ({
			plugin: plugin.name,
			station_id: station,
			camera_id: camera,
			event_type: type,
			from: fromIso,
			to: toIso,
		}),
		[plugin.name, station, camera, type, fromIso, toIso],
	);

	const hasFilter = !!(station || camera || type || params.get("from"));

	const toolbar = (
		<>
			<Select
				allowClear
				showSearch
				optionFilterProp="label"
				style={{ minWidth: 190 }}
				placeholder={t("aiEvent.filter.station")}
				value={station}
				onChange={(v) => set({ station: v, camera: undefined })}
				loading={stations.isLoading}
				options={(stations.data?.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
			/>
			<Select
				allowClear
				style={{ minWidth: 160 }}
				placeholder={station ? t("aiEvent.filter.camera") : t("aiEvent.filter.cameraNeedStation")}
				disabled={!station}
				value={camera}
				onChange={(v) => set({ camera: v != null ? String(v) : undefined })}
				loading={stationDetail.isFetching}
				options={(stationDetail.data?.cameras ?? []).map((c) => ({ value: c.id, label: c.name }))}
			/>
			{plugin.types.length > 1 && (
				<Select
					allowClear
					style={{ minWidth: 150 }}
					placeholder={t("aiEvent.filter.type")}
					value={type}
					onChange={(v) => set({ type: v })}
					options={plugin.types.map((x) => ({ value: x, label: eventTypeLabel(t, x) }))}
				/>
			)}
			<RangePicker
				allowClear={false}
				format="DD/MM/YYYY"
				value={range}
				onChange={(v) => v?.[0] && v[1] && set({ from: v[0].format(DAY), to: v[1].format(DAY) })}
				disabledDate={(d) => d.isAfter(dayjs(), "day")}
				presets={[
					{ label: t("aiEvent.range.today"), value: [dayjs(), dayjs()] },
					{ label: t("aiEvent.range.days", { n: 7 }), value: [dayjs().subtract(6, "day"), dayjs()] },
					{ label: t("aiEvent.range.days", { n: 30 }), value: [dayjs().subtract(29, "day"), dayjs()] },
					{ label: t("aiEvent.range.days", { n: 90 }), value: [dayjs().subtract(89, "day"), dayjs()] },
				]}
			/>
			{hasFilter && (
				<Button
					variant="ghost"
					onClick={() =>
						set({ station: undefined, camera: undefined, type: undefined, from: undefined, to: undefined })
					}
				>
					<Icon icon="solar:restart-linear" size={16} />
					{t("aiEvent.filter.reset")}
				</Button>
			)}
		</>
	);

	return { filters, toolbar, query: params.toString(), station };
}
