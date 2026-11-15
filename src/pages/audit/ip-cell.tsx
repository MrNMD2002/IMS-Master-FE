import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import { Badge } from "@/ui/badge";

/** Dải nội bộ: loopback, RFC1918, CGNAT, link-local, IPv6 ULA / link-local. */
function isPrivate(ip: string): boolean {
	const v = ip.toLowerCase();
	if (v.includes(":")) return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
	const [a, b] = v.split(".").map(Number);
	return (
		a === 10 ||
		a === 127 ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254)
	);
}

type Props = { ip?: string | null; method?: string | null; full?: boolean };

/**
 * IP trong nhật ký thao tác, kèm nhãn giải thích:
 * - Trống + method CRON → "Hệ thống" (tác vụ định kỳ, không có request nên không có IP).
 * - IP nội bộ → nhãn "Nội bộ" (mạng Docker: dòng ghi trước khi đọc IP thật, hoặc gọi API trực tiếp không qua tên miền).
 * - IPv6 → nhãn "IPv6"; địa chỉ giữ một dòng trong bảng (nhãn xuống dòng nếu thiếu chỗ).
 */
export function IpCell({ ip, method, full }: Props) {
	const { t } = useTranslation();
	if (!ip) {
		return method === "CRON" ? (
			<Tooltip title={t("audit.ipSystemHint")}>
				<Badge variant="secondary">{t("audit.ipSystem")}</Badge>
			</Tooltip>
		) : (
			<Tooltip title={t("audit.ipUnknownHint")}>
				<span className="text-text-disabled">—</span>
			</Tooltip>
		);
	}
	const v6 = ip.includes(":");
	const internal = isPrivate(ip);
	return (
		<span className="inline-flex flex-wrap items-center gap-1">
			<span className={`font-mono text-xs ${full ? "break-all" : "whitespace-nowrap"}`}>{ip}</span>
			{internal ? (
				<Tooltip title={t("audit.ipInternalHint")}>
					<Badge variant="warning">{t("audit.ipInternal")}</Badge>
				</Tooltip>
			) : (
				v6 && (
					<Tooltip title={t("audit.ipV6Hint")}>
						<Badge variant="info">IPv6</Badge>
					</Tooltip>
				)
			)}
		</span>
	);
}
