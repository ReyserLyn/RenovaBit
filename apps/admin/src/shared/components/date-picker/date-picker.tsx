import { Calendar01Icon, Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { Calendar } from "@renovabit/ui/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@renovabit/ui/components/ui/popover";
import { format, type Locale } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { TimePicker } from "@/shared/components/time-picker/time-picker";

interface DatePickerBaseProps {
	placeholder?: string;
	disabled?: boolean;
	disabledAfter?: Date;
	disabledBefore?: Date;
	locale?: Locale;
	buttonClassName?: string;
	align?: "start" | "center" | "end";
	id?: string;
}

interface DatePickerProps extends DatePickerBaseProps {
	value: Date | undefined;
	onChange: (date: Date | undefined) => void;
}

/**
 * DatePicker — date only. Matches the exact pattern from
 * `apps/admin/src/features/orders/components/order-table.tsx`:
 * - Popover + Button (outline) trigger with Calendar01Icon and `format(value, "d MMM yyyy", { locale: es })`
 * - Calendar mode="single" inside PopoverContent (p-0)
 * - Optional disabled range (before / after) and clear button
 */
export function DatePicker({
	value,
	onChange,
	placeholder = "Seleccionar",
	disabled = false,
	disabledAfter,
	disabledBefore,
	locale = es,
	buttonClassName = "h-8 w-[145px] justify-start gap-1.5 bg-card font-normal data-[empty=true]:text-muted-foreground",
	align = "start",
	id,
}: DatePickerProps) {
	const [open, setOpen] = useState(false);

	const disabledRange =
		disabledBefore && disabledAfter
			? { before: disabledBefore, after: disabledAfter }
			: disabledBefore
				? { before: disabledBefore }
				: disabledAfter
					? { after: disabledAfter }
					: undefined;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						id={id}
						variant="outline"
						size="sm"
						disabled={disabled}
						data-empty={!value}
						className={buttonClassName}
					>
						<HugeiconsIcon icon={Calendar01Icon} className="size-3.5 shrink-0" />
						{value ? format(value, "d MMM yyyy", { locale }) : <span>{placeholder}</span>}
					</Button>
				}
			/>
			<PopoverContent className="w-auto p-0" align={align}>
				<Calendar
					mode="single"
					selected={value}
					onSelect={(date) => {
						onChange(date ?? undefined);
						setOpen(false);
					}}
					disabled={disabledRange}
					locale={locale}
				/>
				{value && (
					<div className="border-t p-2">
						<Button
							variant="ghost"
							size="sm"
							className="w-full text-muted-foreground"
							onClick={() => {
								onChange(undefined);
								setOpen(false);
							}}
						>
							Limpiar
						</Button>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}

function combineDateAndTime(date: Date, timeStr: string): Date {
	const [hours, minutes] = timeStr.split(":").map(Number);
	const result = new Date(date);
	result.setHours(hours ?? 0, minutes ?? 0, 0, 0);
	return result;
}

function extractTime(date: Date): string {
	const h = date.getHours().toString().padStart(2, "0");
	const m = date.getMinutes().toString().padStart(2, "0");
	return `${h}:${m}`;
}

interface DateTimePickerProps extends DatePickerBaseProps {
	value: Date | undefined;
	onChange: (date: Date | undefined) => void;
}

/**
 * DateTimePicker — date + time. For form fields that need datetime.
 * - Uses Calendar (same pattern as orders) for the date
 * - Uses TimePicker (custom Selects) for the time — NO native browser default
 * - Combines both into a single Date value
 */
export function DateTimePicker({
	value,
	onChange,
	placeholder = "Seleccionar fecha y hora",
	disabled = false,
	disabledAfter,
	disabledBefore,
	locale = es,
	buttonClassName = "h-10 w-full justify-start gap-1.5 bg-card font-normal data-[empty=true]:text-muted-foreground",
	align = "start",
	id,
}: DateTimePickerProps) {
	const [open, setOpen] = useState(false);
	const timeStr = value ? extractTime(value) : "";

	const handleDateSelect = (date: Date | undefined) => {
		if (!date) {
			onChange(undefined);
			return;
		}
		onChange(combineDateAndTime(date, timeStr || "00:00"));
	};

	const handleTimeChange = (newTime: string) => {
		const baseDate = value ?? new Date();
		if (newTime) {
			onChange(combineDateAndTime(baseDate, newTime));
		} else {
			onChange(baseDate);
		}
	};

	const handleClearTime = () => {
		if (value) {
			const cleared = new Date(value);
			cleared.setHours(0, 0, 0, 0);
			onChange(cleared);
		}
	};

	const disabledRange =
		disabledBefore && disabledAfter
			? { before: disabledBefore, after: disabledAfter }
			: disabledBefore
				? { before: disabledBefore }
				: disabledAfter
					? { after: disabledAfter }
					: undefined;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						id={id}
						variant="outline"
						size="sm"
						disabled={disabled}
						data-empty={!value}
						className={buttonClassName}
					>
						<HugeiconsIcon icon={Calendar01Icon} className="size-3.5 shrink-0" />
						{value ? format(value, "d MMM yyyy HH:mm", { locale }) : <span>{placeholder}</span>}
					</Button>
				}
			/>
			<PopoverContent className="w-auto p-0" align={align}>
				<Calendar
					mode="single"
					selected={value}
					onSelect={handleDateSelect}
					disabled={disabledRange}
					locale={locale}
				/>
				<div className="flex items-center gap-3 border-t p-3">
					<div className="flex flex-col gap-1.5">
						<span className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
							<HugeiconsIcon icon={Clock01Icon} className="size-3" />
							Hora
						</span>
						<TimePicker
							id={`${id ?? "datetime"}-time`}
							value={timeStr}
							onChange={handleTimeChange}
						/>
					</div>
					{timeStr && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="text-muted-foreground mt-5"
							onClick={handleClearTime}
						>
							Quitar hora
						</Button>
					)}
				</div>
				{value && (
					<div className="border-t p-2">
						<Button
							variant="ghost"
							size="sm"
							className="w-full text-muted-foreground"
							onClick={() => {
								onChange(undefined);
								setOpen(false);
							}}
						>
							Limpiar
						</Button>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
