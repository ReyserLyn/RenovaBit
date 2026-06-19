import { Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@renovabit/ui/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@renovabit/ui/components/ui/select";
import { useState } from "react";

const hourItems = Array.from({ length: 24 }, (_, h) => {
	const value = h.toString().padStart(2, "0");
	return { value, label: value };
});

const minuteItems = ["00", "15", "30", "45"].map((value) => ({ value, label: value }));

interface TimePickerProps {
	value: string;
	onChange: (time: string) => void;
	placeholder?: string;
	disabled?: boolean;
	locale?: string;
	id?: string;
}

/**
 * TimePicker — custom time picker built from Popover + Selects.
 *
 * Pattern follows the official Date Picker documentation (composition of Popover + child components).
 * Uses two Selects (hour 00-23, minute 00/15/30/45) — no native browser default.
 *
 * Value is a "HH:MM" string. Empty string means no value.
 */
export function TimePicker({
	value,
	onChange,
	placeholder = "Seleccionar hora",
	disabled = false,
	id,
}: TimePickerProps) {
	const [open, setOpen] = useState(false);
	const [hour, minute] = value ? value.split(":") : ["", ""];

	const handleHourChange = (newHour: string) => {
		onChange(`${newHour}:${minute || "00"}`);
	};

	const handleMinuteChange = (newMinute: string) => {
		onChange(`${hour || "00"}:${newMinute}`);
	};

	const handleClear = () => {
		onChange("");
		setOpen(false);
	};

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
						className="h-10 w-full justify-start gap-1.5 bg-card font-normal data-[empty=true]:text-muted-foreground"
					>
						<HugeiconsIcon icon={Clock01Icon} className="size-4 shrink-0" />
						{value ? (
							<span className="font-mono tabular-nums">{value}</span>
						) : (
							<span>{placeholder}</span>
						)}
					</Button>
				}
			/>
			<PopoverContent className="w-auto p-3" align="start">
				<div className="flex items-end gap-2">
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor={`${id ?? "time"}-hour`}
							className="text-muted-foreground text-xs font-medium"
						>
							Hora
						</label>
						<Select
							items={hourItems}
							value={hour}
							onValueChange={(v) => {
								if (v) handleHourChange(v);
							}}
						>
							<SelectTrigger id={`${id ?? "time"}-hour`} className="h-9 w-[72px] bg-card font-mono">
								<SelectValue placeholder="--" />
							</SelectTrigger>
							<SelectContent>
								{hourItems.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<span className="text-muted-foreground text-lg leading-9">:</span>
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor={`${id ?? "time"}-minute`}
							className="text-muted-foreground text-xs font-medium"
						>
							Min
						</label>
						<Select
							items={minuteItems}
							value={minute}
							onValueChange={(v) => {
								if (v) handleMinuteChange(v);
							}}
						>
							<SelectTrigger
								id={`${id ?? "time"}-minute`}
								className="h-9 w-[72px] bg-card font-mono"
							>
								<SelectValue placeholder="--" />
							</SelectTrigger>
							<SelectContent>
								{minuteItems.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
				{value && (
					<div className="mt-2 border-t pt-2">
						<Button
							variant="ghost"
							size="sm"
							className="w-full text-muted-foreground"
							onClick={handleClear}
						>
							Limpiar
						</Button>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
