type NavButtonProps = {
    label: string;
    onClick: () => void;
    children: React.ReactNode;
};

export default function NavButton({
    label,
    onClick,
    children,
}: NavButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="grid size-8 place-items-center rounded-lg hover:bg-(--surface) [&>svg]:size-4"
            aria-label={label}
        >
            {children}
        </button>
    );
}