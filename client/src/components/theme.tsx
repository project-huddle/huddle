import { Moon, Sun } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
	theme: Theme;
	toggleTheme: () => void;
} | null>(null);

function getInitialTheme(): Theme {
	const saved = localStorage.getItem("huddle-theme");
	if (saved === "light" || saved === "dark") return saved;
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setTheme] = useState<Theme>(getInitialTheme);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
		document.documentElement.style.colorScheme = theme;
		localStorage.setItem("huddle-theme", theme);
	}, [theme]);

	return (
		<ThemeContext.Provider
			value={{
				theme,
				toggleTheme: () =>
					setTheme((value) => (value === "dark" ? "light" : "dark")),
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) throw new Error("useTheme must be used inside ThemeProvider");
	return context;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
	const { theme, toggleTheme } = useTheme();
	return (
		<button
			type="button"
			onClick={toggleTheme}
			className={`theme-toggle ${className}`}
			aria-label={
				theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"
			}
			title={theme === "dark" ? "Tema claro" : "Tema escuro"}
		>
			{theme === "dark" ? (
				<Sun className="size-4" />
			) : (
				<Moon className="size-4" />
			)}
		</button>
	);
}
