import { cn } from "@/utils";

const PALETTE = ["#00A76F", "#078DEE", "#7635DC", "#2065D1", "#FDA92D", "#FF5630", "#00B8D9", "#B76E00"];

function initials(name?: string | null) {
	if (!name) return "?";
	const parts = name.trim().split(/\s+/);
	const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
	return letters.toUpperCase();
}

function colorOf(name?: string | null) {
	let h = 0;
	for (const ch of name || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	return PALETTE[h % PALETTE.length];
}

/** Ảnh đại diện chữ cái đầu, màu cố định theo tên. */
export default function UserAvatar({
	name,
	size = 32,
	className,
}: {
	name?: string | null;
	size?: number;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
				className,
			)}
			style={{ width: size, height: size, background: colorOf(name), fontSize: size * 0.38 }}
		>
			{initials(name)}
		</span>
	);
}
