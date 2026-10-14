import { NavLink } from "react-router";
import BrandIcon from "@/assets/brand/icon.png";
import { GLOBAL_CONFIG } from "@/global-config";
import { cn } from "@/utils";

interface Props {
	size?: number;
	className?: string;
}

/** Biểu tượng Command Center (khiên + ghim bản đồ). Tên hệ thống hiển thị bằng chữ riêng
 * để tự đổi màu theo giao diện sáng / tối. */
function Logo({ size = 36, className }: Props) {
	return (
		<NavLink to="/" className={cn("inline-flex shrink-0", className)}>
			<img src={BrandIcon} alt={GLOBAL_CONFIG.appName} width={size} height={size} style={{ objectFit: "contain" }} />
		</NavLink>
	);
}

export default Logo;
