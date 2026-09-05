import { useEffect, useRef } from "react";
import { Picker } from "emoji-mart";
import data from "@emoji-mart/data";
import i18n from "@emoji-mart/data/i18n/pt.json";
import { useTheme } from "@/components/theme";

type EmojiPickerProps = {
	onSelect: (emoji: string) => void;
};

export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
	const { theme } = useTheme();
	const containerRef = useRef<HTMLDivElement>(null);
	const onSelectRef = useRef(onSelect);

	useEffect(() => {
		onSelectRef.current = onSelect;
	}, [onSelect]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const picker = new Picker({
			data,
			i18n,
			theme,
			set: "native",
			autoFocus: true,
			dynamicWidth: true,
			previewPosition: "none",
			persistantSearch: true,
			onEmojiSelect: (emoji: { native: string }) => onSelectRef.current(emoji.native),
		});
		if (!(picker instanceof HTMLElement)) return;
		const colors = theme === "dark"
			? { background: "21, 28, 36", input: "9, 15, 22", color: "255, 240, 232" }
			: { background: "255, 240, 232", input: "247, 244, 241", color: "40, 45, 51" };
		picker.style.setProperty("--rgb-background", colors.background);
		picker.style.setProperty("--rgb-input", colors.input);
		picker.style.setProperty("--rgb-color", colors.color);
		picker.style.setProperty("--rgb-accent", "255, 89, 0");
		picker.style.width = "100%";
		container.appendChild(picker);
		return () => picker.remove();
	}, [theme]);

	return <div ref={containerRef} className="w-full" />;
}
