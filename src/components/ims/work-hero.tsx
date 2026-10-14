import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";

interface Quote {
	text: string;
	author: string;
	/** Văn bản / năm xuất xứ (có thể rỗng). */
	source?: string;
}

/** Số giờ kể từ một mốc — dùng làm chỉ số câu, đổi câu mỗi khi sang giờ mới. */
const hourSlot = () => dayjs().diff(dayjs("2026-01-01"), "hour");

/**
 * Câu trích dẫn của Chủ tịch Hồ Chí Minh, danh nhân, tướng lĩnh, lãnh đạo — mỗi giờ một câu
 * (tự chuyển khi sang giờ mới, không cần tải lại), bấm ↻ để đổi ngay.
 */
export function WorkQuote() {
	const { t, i18n } = useTranslation();
	// biome-ignore lint/correctness/useExhaustiveDependencies: đổi ngôn ngữ → lấy lại danh sách câu
	const quotes = useMemo(
		() => t("dashboard.quotes", { returnObjects: true }) as unknown as Quote[],
		[t, i18n.language],
	);
	const [slot, setSlot] = useState(hourSlot);
	const [skip, setSkip] = useState(0); // số lần bấm "Câu khác" trong giờ hiện tại
	useEffect(() => {
		const timer = setInterval(() => {
			const now = hourSlot();
			setSlot((prev) => {
				if (prev !== now) setSkip(0);
				return now;
			});
		}, 30_000);
		return () => clearInterval(timer);
	}, []);
	const n = quotes.length;
	const q = n ? quotes[(((slot + skip) % n) + n) % n] : null;
	if (!q) return null;

	return (
		<figure className="flex items-start gap-3">
			<Icon icon="solar:chat-square-quote-bold-duotone" size={36} className="mt-1 shrink-0 text-primary" />
			<div className="min-w-0">
				<blockquote className="text-xl font-semibold leading-snug sm:text-2xl">“{q.text}”</blockquote>
				<figcaption className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
					<span className="font-semibold text-text-primary">— {q.author}</span>
					{q.source && <span className="italic">· {q.source}</span>}
					<button
						type="button"
						onClick={() => setSkip((s) => s + 1)}
						title={t("dashboard.nextQuote")}
						className="rounded-full p-1 text-text-disabled transition-colors hover:bg-action-hover hover:text-primary"
					>
						<Icon icon="solar:refresh-linear" size={14} />
					</button>
				</figcaption>
			</div>
		</figure>
	);
}

/** Đồng hồ 24 giờ chạy từng giây + thứ, ngày. */
export function LiveClock() {
	const [now, setNow] = useState(() => dayjs());
	useEffect(() => {
		const timer = setInterval(() => setNow(dayjs()), 1000);
		return () => clearInterval(timer);
	}, []);
	return (
		<div className="flex shrink-0 flex-col items-end rounded-2xl bg-background/70 px-5 py-3 shadow-sm backdrop-blur">
			<span className="font-mono text-4xl font-bold leading-none tabular-nums tracking-tight">
				{now.format("HH:mm")}
				<span className="text-2xl text-text-secondary">:{now.format("ss")}</span>
			</span>
			<span className="mt-1.5 text-sm capitalize text-text-secondary">{now.format("dddd, DD/MM/YYYY")}</span>
		</div>
	);
}
