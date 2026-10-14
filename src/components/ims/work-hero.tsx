import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";

interface Quote {
	text: string;
	author: string;
}

/** Câu trích dẫn về công việc — mỗi ngày một câu (cố định trong ngày), bấm để đổi câu khác. */
export function WorkQuote() {
	const { t, i18n } = useTranslation();
	const quotes = useMemo(
		() => t("dashboard.quotes", { returnObjects: true }) as unknown as Quote[],
		// biome-ignore lint/correctness/useExhaustiveDependencies: đổi ngôn ngữ → lấy lại danh sách
		[t, i18n.language],
	);
	const [index, setIndex] = useState(() => dayjs().diff(dayjs("2026-01-01"), "day"));
	const q = quotes.length ? quotes[((index % quotes.length) + quotes.length) % quotes.length] : null;
	if (!q) return null;

	return (
		<figure className="flex items-start gap-3">
			<Icon icon="solar:chat-square-quote-bold-duotone" size={36} className="mt-1 shrink-0 text-primary" />
			<div className="min-w-0">
				<blockquote className="text-xl font-semibold leading-snug sm:text-2xl">“{q.text}”</blockquote>
				<figcaption className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
					<span>— {q.author}</span>
					<button
						type="button"
						onClick={() => setIndex((i) => i + 1)}
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
