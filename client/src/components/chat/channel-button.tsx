import { cn } from "@/lib/utils";
import { Hash } from "lucide-react";

type ChannelButtonProps = {
    id: string;
    name: string;
    active: boolean;
    onSelect: (id: string) => void;
    variant?: "desktop" | "mobile";
};

export default function ChannelButton({
    id,
    name,
    active,
    onSelect,
    variant = "desktop",
}: ChannelButtonProps) {
    const handleClick = () => {
        onSelect(id);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            className={cn(
                "flex w-full items-center gap-2 rounded-xl px-3 text-left text-sm",
                variant === "desktop" ? "py-2" : "mb-1 py-3",
                active
                    ? "bg-(--surface) font-bold shadow-sm"
                    : "text-(--muted-text) hover:bg-(--surface)/60",
            )}
        >
            <Hash className="size-4 shrink-0" />

            <span className="truncate">
                {name}
            </span>
        </button>
    );
}
