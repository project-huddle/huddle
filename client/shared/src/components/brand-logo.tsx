import logoDark from "@/assets/logo_dark.svg";
import logoLight from "@/assets/logo_light.svg";
import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
	return (
		<span className={cn("brand-logo", className)}>
			<img src={logoLight} alt="Huddle" className="brand-logo-light" />
			<img src={logoDark} alt="Huddle" className="brand-logo-dark" />
		</span>
	);
}

export function BrandMark({ className }: { className?: string }) {
	return (
		<span className={cn("brand-mark", className)} aria-label="Huddle">
			<img
				src={logoLight}
				alt=""
				aria-hidden="true"
				className="brand-logo-light"
			/>
			<img
				src={logoDark}
				alt=""
				aria-hidden="true"
				className="brand-logo-dark"
			/>
		</span>
	);
}
