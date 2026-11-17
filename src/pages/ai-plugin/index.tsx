import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/ui/card";
import EventTable from "../ai-event/components/event-table";
import PluginShell from "./plugin-shell";

/** Danh sách sự kiện của một plugin (`/ai/p/:slug`) — cột số liệu riêng theo plugin. */
export default function PluginListPage() {
	const { t } = useTranslation();
	return (
		<PluginShell view="list">
			{({ plugin, filters }) => (
				<Card className="gap-0 py-5">
					<CardContent className="px-4 sm:px-6">
						<EventTable key={plugin.name} filters={filters} hidePlugin hideType extraColumns={plugin.columns(t)} />
					</CardContent>
				</Card>
			)}
		</PluginShell>
	);
}
