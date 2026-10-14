import { useEffect, useState } from "react";

/** Trang đã cuộn quá `threshold` px chưa — dùng để thu gọn khối ghim đầu trang. */
export function useScrolled(threshold = 24) {
	const [scrolled, setScrolled] = useState(() => window.scrollY > threshold);
	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > threshold);
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, [threshold]);
	return scrolled;
}
