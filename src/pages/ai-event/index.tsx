import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { DatePicker, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { AI_EVENT_TYPES, type AiEventQuery } from "#/vigil";
import aiStationService from "@/api/services/aiStationService";
import PageHeader from "@/components/cmc/page-header";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { MockNotice } from "../ai-station/components/station-status";
import { KNOWN_PLUGINS } from "./components/event-meta";
import EventStats from "./components/event-stats";
import EventTable from "./components/event-table";

const { RangePicker } = DatePicker;

const defaultRange = (): [Dayjs, Dayjs] => [dayjs().subtract(13, "day").startOf("day"), dayjs().endOf("day")];

/** Sự kiện AI từ mọi trạm: bộ lọc, thống kê, danh sách có ảnh và khung nhận diện. */
export default function AiEventPage() {
	const { t } = useTranslation();
	const [params, setParams] = useSearchParams();
	// ?station= giữ trên đường dẫn để trang chi tiết trạm dẫn sang đúng bộ lọc.
	const stationId = params.get("station") ?? undefined;
	const setStation = (v?: string) => {
		const next = new URLSearchParams(params);
		if (v) next.set("station", v);
		else next.delete("station");
		setParams(next, { replace: true });
		setCameraId(undefined);
	};

	const [cameraId, setCameraId] = useState<number | undefined>();
	const [plugin, setPlugin] = useState<string | undefined>();
	const [eventType, setEventType] = useState<string | undefined>();
	const [range, setRange] = useState<[Dayjs, Dayjs]>(defaultRange);

	const stations = useQuery({
		queryKey: ["ai-station", "list", ""],
		queryFn: () => aiStationService.listStations({ page: 1, page_size: 200 }),
	});
	const station = useQuery({
		queryKey: ["ai-station", "detail", stationId],
		queryFn: () => aiStationService.getStation(stationId as string),
		enabled: !!stationId,
	});

	const filters = useMemo<Omit<AiEventQuery, "page" | "page_size">>(
		() => ({
			station_id: stationId,
			camera_id: cameraId,
			plugin,
			event_type: eventType,
			from: range[0].startOf("day").toISOString(),
			to: range[1].endOf("day").toISOString(),
		}),
		[stationId, cameraId, plugin, eventType, range],
	);

	const stats = useQuery({
		queryKey: ["ai-event", "stats", filters],
		queryFn: () => aiStationService.eventStats(filters),
		placeholderData: keepPreviousData,
		refetchInterval: 60_000,
	});

	const hasFilter = !!(stationId || cameraId || plugin || eventType);
	const reset = () => {
		setStation(undefined);
		setPlugin(undefined);
		setEventType(undefined);
		setRange(defaultRange());
	};

	return (
		<>
			<PageHeader
				icon="solar:bell-bing-bold-duotone"
				title={t("sys.nav.aiEvent")}
				description={t("aiEvent.description")}
				toolbar={
					<>
						<Select
							allowClear
							showSearch
							optionFilterProp="label"
							style={{ minWidth: 200 }}
							placeholder={t("aiEvent.filter.station")}
							value={stationId}
							onChange={setStation}
							loading={stations.isLoading}
							options={(stations.data?.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
						/>
						<Select
							allowClear
							style={{ minWidth: 170 }}
							placeholder={stationId ? t("aiEvent.filter.camera") : t("aiEvent.filter.cameraNeedStation")}
							disabled={!stationId}
							value={cameraId}
							onChange={setCameraId}
							loading={station.isFetching}
							options={(station.data?.cameras ?? []).map((c) => ({ value: c.id, label: c.name }))}
						/>
						<Select
							allowClear
							style={{ minWidth: 180 }}
							placeholder={t("aiEvent.filter.plugin")}
							value={plugin}
							onChange={setPlugin}
							options={KNOWN_PLUGINS.map((p) => ({ value: p, label: t(`aiEvent.plugin.${p}`) }))}
						/>
						<Select
							allowClear
							style={{ minWidth: 170 }}
							placeholder={t("aiEvent.filter.type")}
							value={eventType}
							onChange={setEventType}
							options={AI_EVENT_TYPES.map((x) => ({ value: x, label: t(`aiEvent.type.${x}`) }))}
						/>
						<RangePicker
							allowClear={false}
							format="DD/MM/YYYY"
							value={range}
							onChange={(v) => v?.[0] && v[1] && setRange([v[0], v[1]])}
							disabledDate={(d) => d.isAfter(dayjs(), "day")}
							presets={[
								{ label: t("aiEvent.range.today"), value: [dayjs().startOf("day"), dayjs().endOf("day")] },
								{ label: t("aiEvent.range.days", { n: 7 }), value: [dayjs().subtract(6, "day"), dayjs()] },
								{ label: t("aiEvent.range.days", { n: 14 }), value: [dayjs().subtract(13, "day"), dayjs()] },
								{ label: t("aiEvent.range.days", { n: 30 }), value: [dayjs().subtract(29, "day"), dayjs()] },
							]}
						/>
						{hasFilter && (
							<Button variant="ghost" onClick={reset}>
								<Icon icon="solar:restart-linear" size={16} />
								{t("aiEvent.filter.reset")}
							</Button>
						)}
					</>
				}
			/>
			<MockNotice />
			<div className="flex flex-col gap-4">
				<EventStats data={stats.data} loading={!stats.data} fetching={stats.isFetching} showStations={!stationId} />
				<Card className="gap-0 py-5">
					<CardContent className="px-4 sm:px-6">
						<EventTable filters={filters} />
					</CardContent>
				</Card>
			</div>
		</>
	);
}
