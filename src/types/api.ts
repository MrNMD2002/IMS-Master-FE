/** Khung response chuẩn của CMC API: `{code, data, message}` (+ `metadata` ở danh sách). */
interface ResultMetaData {
	current_page: number;
	page_size: number;
	total_items: number;
}

export interface Result<T = unknown> {
	code: string;
	message: string;
	data: T;
	metadata?: ResultMetaData;
}

/** Kết quả danh sách sau interceptor. */
export interface Paged<T> {
	data: T[];
	metadata: ResultMetaData;
}

export interface PageQuery {
	page?: number;
	page_size?: number;
	sort_by?: string;
	order?: "asc" | "desc";
}
