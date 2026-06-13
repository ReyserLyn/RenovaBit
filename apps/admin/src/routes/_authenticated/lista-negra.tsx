import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { AddBlacklistDialog } from "@/features/blacklist/components/add-blacklist-dialog";
import { BlacklistTable } from "@/features/blacklist/components/blacklist-table";
import { RevertBlacklistDialog } from "@/features/blacklist/components/revert-blacklist-dialog";
import type { BlacklistEntry } from "@/features/blacklist/model";
import { PageHeader } from "@/shared/components/layout/page-header";

export const Route = createFileRoute("/_authenticated/lista-negra")({
	component: ListaNegraPage,
});

function ListaNegraPage() {
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const [revertDialogOpen, setRevertDialogOpen] = useState(false);
	const [entryToRevert, setEntryToRevert] = useState<BlacklistEntry | null>(null);

	const handleRevert = useCallback((entry: BlacklistEntry) => {
		setEntryToRevert(entry);
		setRevertDialogOpen(true);
	}, []);

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Lista negra"
				description="IDs de proveedor bloqueados. No se importarán en futuros syncs. Revertir permite volver a sincronizarlos."
				actions={
					<Button onClick={() => setAddDialogOpen(true)}>
						<HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
						Añadir ID
					</Button>
				}
			/>

			<BlacklistTable onRevert={handleRevert} />

			<AddBlacklistDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />

			<RevertBlacklistDialog
				entry={entryToRevert}
				open={revertDialogOpen}
				onOpenChange={(open) => {
					setRevertDialogOpen(open);
					if (!open) setEntryToRevert(null);
				}}
			/>
		</div>
	);
}
