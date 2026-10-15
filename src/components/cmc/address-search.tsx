import { AutoComplete, Input } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { type GeoResult, searchAddress } from "@/utils/geocode";

/** Ô tìm địa chỉ (gõ → gợi ý → chọn). Chờ người dùng ngừng gõ 500ms mới gọi. */
export default function AddressSearch({
	onSelect,
	className,
	size,
}: {
	onSelect: (r: GeoResult) => void;
	className?: string;
	size?: "small" | "middle" | "large";
}) {
	const { t, i18n } = useTranslation();
	const [q, setQ] = useState("");
	const [results, setResults] = useState<GeoResult[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (q.trim().length < 3) {
			setResults([]);
			return;
		}
		const timer = setTimeout(async () => {
			setLoading(true);
			setResults(await searchAddress(q, i18n.language === "en_US" ? "en" : "vi"));
			setLoading(false);
		}, 500);
		return () => clearTimeout(timer);
	}, [q, i18n.language]);

	return (
		<AutoComplete
			className={className}
			value={q}
			onChange={setQ}
			options={results.map((r, i) => ({ value: `${i}`, label: r.label }))}
			onSelect={(v) => {
				const r = results[Number(v)];
				if (r) {
					setQ(r.label);
					onSelect(r);
				}
			}}
			popupMatchSelectWidth={360}
		>
			<Input
				size={size}
				allowClear
				prefix={<Icon icon={loading ? "svg-spinners:180-ring" : "solar:magnifer-linear"} size={16} />}
				placeholder={t("monitor.searchAddress")}
			/>
		</AutoComplete>
	);
}
