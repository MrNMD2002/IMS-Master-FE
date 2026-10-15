import { type RefObject, useEffect, useRef, useState } from "react";

/** Trang đã cuộn quá `threshold` px chưa. */
export function useScrolled(threshold = 24) {
	const [scrolled, setScrolled] = useState(() => window.scrollY > threshold);
	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > threshold);
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, [threshold]);
	return scrolled;
}

const EXPAND_AT = 8;

/**
 * Thu gọn một khối ghim đầu trang khi cuộn — CÓ ĐỘ TRỄ để không giật.
 *
 * Khối ghim vẫn chiếm chỗ trong dòng chảy trang: thu gọn làm trang ngắn đi đúng phần chênh
 * chiều cao, trình duyệt kéo vị trí cuộn theo → nếu dùng một ngưỡng nhỏ (vd 24px) vị trí cuộn
 * rơi lại dưới ngưỡng → khối mở ra → lại thu gọn… (đo được 19 lần đổi chiều cao / một lượt cuộn).
 *
 * Luật: chỉ thu gọn khi đã cuộn qua HẾT chiều cao khối lúc đầy đủ, chỉ mở lại khi gần sát đỉnh.
 * Phần trang mất đi khi thu gọn luôn nhỏ hơn chiều cao khối, nên sau khi thu gọn vị trí cuộn
 * vẫn ≥ chiều cao bản gọn > EXPAND_AT — không thể bật ngược.
 */
export function useCompactOnScroll(ref: RefObject<HTMLElement | null>) {
	const [compact, setCompact] = useState(false);
	const compactRef = useRef(false);
	const fullHeight = useRef(0);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		// Chỉ ghi nhận chiều cao lúc ĐẦY ĐỦ (đổi theo khổ màn hình, dữ liệu tải xong...).
		const ro = new ResizeObserver(() => {
			if (!compactRef.current) fullHeight.current = el.offsetHeight;
		});
		ro.observe(el);
		const onScroll = () => {
			const y = window.scrollY;
			const next = compactRef.current ? y > EXPAND_AT : y > Math.max(fullHeight.current, 48);
			if (next !== compactRef.current) {
				compactRef.current = next;
				setCompact(next);
			}
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		onScroll();
		return () => {
			ro.disconnect();
			window.removeEventListener("scroll", onScroll);
		};
	}, [ref]);
	return compact;
}
