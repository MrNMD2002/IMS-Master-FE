import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AiEvent, AiEventQuery } from "#/vigil";
import aiStationService from "@/api/services/aiStationService";
import EmptyState from "@/components/cmc/empty-state";
import { Icon } from "@/components/icon";
import { fmtDateTime, fmtFromNow } from "@/utils/format";
import EventDetailModal from "./event-detail-modal";
import EventImage from "./event-image";
import { EventTypeTag, ScoreText, useEventSummary } from "./event-meta";

/**
 * Bảng sự kiện AI có ảnh thu nhỏ, phân trang phía máy chủ; bấm dòng mở chi tiết.
 * `hideStation` khi bảng nằm trong trang chi tiết một trạm.
 */
export default function EventTable({
	filters,
	hideStation,
	defaultPageSize = 10,
}: {
	filters: Omit<AiEventQuery, "page" | "page_size">;
	hideStation?: boolean;
	defaultPageSize?: number;
}) {
	const { t } = useTranslation();
	const summary = useEventSummary();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(defaultPageSize);
	const [viewing, setViewing] = useState<AiEvent | null>(null);

	const filterKey = JSON.stringify(filters);
	// Đổi bộ lọc → về trang 1.
	// biome-ignore lint/correctness/useExhaustiveDependencies: chỉ chạy khi chuỗi bộ lọc đổi
	useEffect(() => setPage(1), [filterKey]);

	const { data, isFetching } = useQuery({
		queryKey: ["ai-event", "list", filters, page, pageSize],
		queryFn: () => aiStationService.listEvents({ ...filters, page, page_size: pageSize }),
		placeholderData: keepPreviousData,
		refetchInterval: 30_000,
	});

	const columns: ColumnsType<AiEvent> = [
		{
			key: "thumb",
			width: 136,
			render: (_, e) => (
				<EventImage src={e.image_url} objects={e.objects} compact className="w-[120px]" alt={e.camera_name} />
			),
		},
		{
			title: t("aiEvent.field.time"),
			key: "time",
			render: (_, e) => (
				<div className="whitespace-nowrap text-sm">
					<p>{fmtDateTime(e.captured_at.wall_us / 1e6, "DD/MM/YYYY HH:mm:ss")}</p>
					<p className="text-xs text-text-secondary">{fmtFromNow(e.captured_at.wall_us / 1e6)}</p>
				</div>
			),
		},
		{
			title: t("aiEvent.field.type"),
			key: "type",
			render: (_, e) => (
				<div className="flex min-w-[150px] flex-col items-start gap-1">
					<EventTypeTag type={e.event_type} />
					<span className="max-w-[220px] truncate text-xs text-text-secondary">{summary(e)}</span>
				</div>
			),
		},
		...(hideStation
			? []
			: [
					{
						title: t("aiEvent.field.station"),
						key: "station",
						render: (_: unknown, e: AiEvent) => <span className="text-sm">{e.station_name}</span>,
					},
				]),
		{
			title: t("aiEvent.field.camera"),
			key: "camera",
			render: (_, e) => (
				<div className="text-sm">
					<p className="inline-flex items-center gap-1">
						<Icon icon="solar:videocamera-record-linear" size={15} className="text-text-secondary" />
						{e.camera_name}
					</p>
					{e.zone_name && <p className="text-xs text-text-secondary">{t("aiEvent.zoneOf", { zone: e.zone_name })}</p>}
				</div>
			),
		},
		{
			title: t("aiEvent.field.plugin"),
			dataIndex: "plugin",
			render: (p: string) => <span className="text-sm">{t(`aiEvent.plugin.${p}`, { defaultValue: p })}</span>,
		},
		{
			title: t("aiEvent.field.score"),
			dataIndex: "score",
			align: "right",
			render: (s: number) => <ScoreText score={s} />,
		},
	];

	return (
		<>
			<Table<AiEvent>
				rowKey="event_id"
				size="middle"
				scroll={{ x: "max-content" }}
				loading={isFetching && !data}
				columns={columns}
				dataSource={data?.items ?? []}
				onRow={(e) => ({ onClick: () => setViewing(e), className: "cursor-pointer" })}
				locale={{ emptyText: <EmptyState text={t("aiEvent.empty")} icon="solar:bell-off-bold-duotone" /> }}
				pagination={{
					current: page,
					pageSize,
					total: data?.total ?? 0,
					showSizeChanger: true,
					pageSizeOptions: [10, 20, 50],
					showTotal: (total) => t("common.totalItems", { total }),
					onChange: (p, s) => {
						setPage(p);
						setPageSize(s);
					},
				}}
			/>
			<EventDetailModal event={viewing} onClose={() => setViewing(null)} />
		</>
	);
}
