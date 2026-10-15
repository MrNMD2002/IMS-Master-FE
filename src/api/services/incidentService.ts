import type { AxiosResponse } from "axios";
import type { Paged, PageQuery } from "#/api";
import type {
	Incident,
	IncidentImage,
	IncidentLog,
	IncidentQuery,
	IncidentReportQuery,
	IncidentReportStats,
	IncidentReq,
} from "#/ims";
import apiClient from "../apiClient";

const list = (params: PageQuery & IncidentQuery) => apiClient.get<Paged<Incident>>({ url: "/incident/list", params });
const detail = (id: number) => apiClient.get<Incident>({ url: `/incident/detail/${id}` });
const logs = (id: number) => apiClient.get<IncidentLog[]>({ url: `/incident/${id}/logs` });
const create = (data: IncidentReq) => apiClient.post<Incident>({ url: "/incident/create", data });
const update = (id: number, data: IncidentReq) => apiClient.post<Incident>({ url: `/incident/update/${id}`, data });
const remove = (id: number) => apiClient.post({ url: `/incident/delete/${id}` });
/** `note` được gửi xuống App các xe còn làm nhiệm vụ khi đóng sự vụ. */
const setStatus = (id: number, status: "PENDING_APPROVAL" | "COMPLETED", note?: string) =>
	apiClient.post<Incident>({ url: `/incident/${id}/status`, data: { status, note: note || undefined } });
const close = (id: number) => apiClient.post<Incident>({ url: `/incident/${id}/close` });
const dispatch = (id: number, device_ids: number[], note?: string) =>
	apiClient.post<Incident>({ url: `/incident/${id}/dispatch-devices`, data: { device_ids, note: note || undefined } });
/** `note` = lý do rút, gửi kèm lệnh rút xuống App của xe. */
const recall = (id: number, device_ids: number[], note?: string) =>
	apiClient.post<Incident>({ url: `/incident/${id}/recall-devices`, data: { device_ids, note: note || undefined } });

/** Báo kết thúc thay cho một xe (quản trị — ảnh tuỳ chọn). */
const completeDevice = (id: number, device_id: number, note?: string) => {
	const form = new FormData();
	if (note) form.append("note", note);
	return apiClient.post<Incident>({
		url: `/incident/${id}/complete`,
		params: { device_id },
		data: form,
		headers: { "Content-Type": "multipart/form-data" },
	});
};

/** Danh sách ảnh hiện trường (chi tiết sự vụ KHÔNG kèm ảnh — trường `images` luôn rỗng). */
const images = (id: number) => apiClient.get<IncidentImage[]>({ url: `/incident/${id}/images` });

const deleteImage = (id: number, imageId: number) =>
	apiClient.post({ url: `/incident/${id}/images/${imageId}/delete` });

/** Ảnh hiện trường phải lấy kèm token → blob URL (thẻ <img> không gửi được header). */
const imageBlobUrl = async (id: number, imageId: number) => {
	const res = await apiClient.get<AxiosResponse<Blob>>({
		url: `/incident/${id}/images/${imageId}/raw`,
		responseType: "blob",
		raw: true,
		silent: true,
	});
	return URL.createObjectURL(res.data);
};

/** Thống kê theo ngày / tuần / tháng / năm (giờ Việt Nam), cùng phạm vi với danh sách. */
const reportStats = (params: IncidentReportQuery) =>
	apiClient.get<IncidentReportStats>({ url: "/incident/report/stats", params });

/** Excel báo cáo (không kèm ảnh). */
const reportExport = async (params: IncidentReportQuery) => {
	const res = await apiClient.get<AxiosResponse<Blob>>({
		url: "/incident/report/export",
		params,
		responseType: "blob",
		raw: true,
	});
	const disposition = res.headers["content-disposition"] as string | undefined;
	const name = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i)?.[1];
	return { blob: res.data, filename: name ? decodeURIComponent(name) : "bao-cao-su-vu.xlsx" };
};

export default {
	list,
	detail,
	logs,
	create,
	update,
	remove,
	setStatus,
	close,
	dispatch,
	recall,
	completeDevice,
	images,
	deleteImage,
	imageBlobUrl,
	reportStats,
	reportExport,
};
