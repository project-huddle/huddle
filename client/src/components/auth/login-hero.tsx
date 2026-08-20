import { BrandLogo } from "@/components/brand-logo";

export function LoginHero() {
	return (
<section className="login-hero relative hidden overflow-hidden bg-[var(--solid)] p-10 text-[var(--cream)] lg:flex lg:flex-col">
					<div className="absolute -right-28 -top-28 size-96 rounded-full border-70 border-[var(--brand)]/10" />
					<div className="absolute -bottom-36 -left-24 size-105 rounded-full bg-[var(--brand)] opacity-90" />
					<BrandLogo className="relative w-40" />
					<div className="relative my-auto max-w-lg">
						<p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand)]">
							Só entre a gente
						</p>
						<h1 className="text-6xl font-black leading-[0.9] tracking-[-0.065em]">
							Menos rede.
							<br />
							Mais conversa.
						</h1>
						<p className="mt-7 max-w-sm text-lg leading-relaxed text-[var(--on-solid)]/55">
							Uma sala simples para o seu grupo falar, rir, mandar
							coisas e aparecer quando der.
						</p>
					</div>
					<p className="relative text-xs text-[var(--on-solid)]/40">
						privado por natureza · pequeno de propósito
					</p>
				</section>
	);
}
