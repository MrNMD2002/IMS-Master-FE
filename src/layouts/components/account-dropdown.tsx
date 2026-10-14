import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { Icon } from "@/components/icon";
import UserAvatar from "@/components/user-avatar";
import { useRouter } from "@/routes/hooks";
import { signOut, useUserInfo } from "@/store/userStore";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

export default function AccountDropdown() {
	const { replace } = useRouter();
	const { username, full_name, role, tenant_name } = useUserInfo();
	const { t } = useTranslation();

	const logout = async () => {
		await signOut();
		replace("/auth/login");
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className="rounded-full">
					<UserAvatar name={full_name || username} size={28} />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-64" align="end">
				<div className="flex items-center gap-3 p-2">
					<UserAvatar name={full_name || username} size={40} />
					<div className="flex flex-col items-start min-w-0">
						<div className="text-text-primary text-sm font-semibold truncate max-w-full">{full_name || username}</div>
						<div className="text-text-secondary text-xs truncate max-w-full">@{username}</div>
					</div>
				</div>
				<div className="flex flex-wrap gap-1 px-2 pb-2">
					{role && <Badge variant="info">{t(`role.names.${role}`, { defaultValue: role })}</Badge>}
					{tenant_name && (
						<Badge variant="secondary" className="max-w-full truncate">
							<Icon icon="solar:buildings-2-bold-duotone" size={12} />
							{tenant_name}
						</Badge>
					)}
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<NavLink to="/profile">
						<Icon icon="solar:user-circle-bold-duotone" size={18} />
						{t("sys.nav.profile")}
					</NavLink>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem className="font-semibold text-error" onClick={logout}>
					<Icon icon="solar:logout-2-bold-duotone" size={18} />
					{t("sys.login.logout")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
