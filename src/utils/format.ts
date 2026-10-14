import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";

dayjs.extend(relativeTime);
dayjs.extend(utc);

/**
 * API trả datetime không kèm múi giờ (UTC naive) → coi là UTC rồi đổi về giờ máy.
 * Chuỗi đã có `Z` / `+07:00` thì giữ nguyên.
 */
export const parseApiTime = (value?: string | number | null) => {
	if (value === null || value === undefined || value === "") return null;
	if (typeof value === "number") return dayjs.unix(value);
	return /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? dayjs(value) : dayjs.utc(value).local();
};

export const fmtDateTime = (value?: string | number | null, pattern = "DD/MM/YYYY HH:mm") =>
	parseApiTime(value)?.format(pattern) ?? "—";

export const fmtFromNow = (value?: string | number | null) => parseApiTime(value)?.fromNow() ?? "—";

export const fmtSecondsAgo = (seconds: number) => dayjs().subtract(seconds, "second").fromNow();

export const fmtNumber = (n?: number | null, digits = 0) =>
	n === null || n === undefined ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: digits });

/** Tải blob về máy với tên file. */
export const downloadBlob = (blob: Blob, filename: string) => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
};
