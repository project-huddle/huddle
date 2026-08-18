import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, Eye, EyeOff, LoaderCircle, Sparkles } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { loginSchema, type LoginFormData } from "@/schemas/login-schema"
import { useAuthStore } from "@/stores/auth-store"

export default function LoginPage() {
    const [showPassword, setShowPassword] = useState(false)
    const [isRegistering, setIsRegistering] = useState(false)
    const [displayName, setDisplayName] = useState("")
    const { login, register: createAccount, isLoading, error, clearError } = useAuthStore()
    const { register: registerField, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: "", password: "", remember: true },
    })

    const onSubmit = async (data: LoginFormData) => {
        try {
            if (isRegistering) await createAccount(data.email, displayName, data.password)
            else await login(data.email, data.password, data.remember)
        } catch { /* A store exibe o erro. */ }
    }

    const inputClass = "h-12 w-full rounded-2xl border border-[#20251f]/15 bg-white px-4 outline-none transition placeholder:text-[#9aa197] focus:border-[#20251f] focus:ring-4 focus:ring-[#d9ff8f]/60"

    return <main className="min-h-svh bg-[#f3f0e7] p-3 text-[#20251f] sm:p-5">
        <div className="mx-auto grid min-h-[calc(100svh-24px)] max-w-6xl overflow-hidden rounded-[32px] border border-[#20251f]/10 bg-white shadow-[0_24px_80px_rgba(32,37,31,.1)] sm:min-h-[calc(100svh-40px)] lg:grid-cols-[1.05fr_.95fr]">
            <section className="relative hidden overflow-hidden bg-[#20251f] p-10 text-white lg:flex lg:flex-col">
                <div className="absolute -right-28 -top-28 size-96 rounded-full border-70 border-[#d9ff8f]/10" />
                <div className="absolute -bottom-36 -left-24 size-105 rounded-full bg-[#f2a65a] opacity-90" />
                <div className="relative flex items-center gap-3"><div className="grid size-10 rotate-3 place-items-center rounded-[13px] bg-[#d9ff8f] text-[#20251f]"><Sparkles className="size-5" /></div><span className="text-lg font-black tracking-[-0.04em]">peniscord</span></div>
                <div className="relative my-auto max-w-lg"><p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-[#d9ff8f]">Só entre a gente</p><h1 className="text-6xl font-black leading-[0.9] tracking-[-0.065em]">Menos rede.<br />Mais conversa.</h1><p className="mt-7 max-w-sm text-lg leading-relaxed text-white/55">Uma sala simples para o seu grupo falar, rir, mandar coisas e aparecer quando der.</p></div>
                <p className="relative text-xs text-white/40">privado por natureza · pequeno de propósito</p>
            </section>

            <section className="flex items-center justify-center px-5 py-10 sm:px-12">
                <div className="w-full max-w-sm">
                    <div className="mb-10 flex items-center gap-3 lg:hidden"><div className="grid size-10 rotate-3 place-items-center rounded-[13px] bg-[#20251f] text-[#d9ff8f]"><Sparkles className="size-5" /></div><span className="text-lg font-black">peniscord</span></div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#71806f]">{isRegistering ? "Primeira visita?" : "Bom te ver"}</p>
                    <h2 className="mt-3 text-4xl font-black tracking-[-0.055em]">{isRegistering ? "Chega mais." : "Entre na sala."}</h2>
                    <p className="mt-2 text-sm text-[#71806f]">{isRegistering ? "Crie sua conta em menos de um minuto." : "Use seus dados para continuar a conversa."}</p>

                    <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
                        {isRegistering && <label className="block"><span className="mb-2 block text-xs font-bold">Como vamos te chamar?</span><input value={displayName} onChange={(event) => { setDisplayName(event.target.value.slice(0, 32)); clearError() }} minLength={2} required placeholder="Seu nome" className={inputClass} />{displayName.length > 0 && displayName.trim().length < 2 && <span className="mt-1 block text-xs text-[#b54e42]">Use pelo menos 2 caracteres</span>}</label>}
                        <label className="block"><span className="mb-2 block text-xs font-bold">E-mail</span><input type="email" autoComplete="email" placeholder="voce@exemplo.com" aria-invalid={Boolean(errors.email)} className={inputClass} {...registerField("email", { onChange: clearError })} />{errors.email && <span className="mt-1 block text-xs text-[#b54e42]">{errors.email.message}</span>}</label>
                        <label className="block"><span className="mb-2 block text-xs font-bold">Senha</span><div className="relative"><input type={showPassword ? "text" : "password"} autoComplete={isRegistering ? "new-password" : "current-password"} placeholder="mínimo de 8 caracteres" aria-invalid={Boolean(errors.password)} className={`${inputClass} pr-12`} {...registerField("password", { onChange: clearError })} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#71806f]" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>{errors.password && <span className="mt-1 block text-xs text-[#b54e42]">{errors.password.message}</span>}</label>
                        {!isRegistering && <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[#596357]"><input type="checkbox" className="size-4 accent-[#20251f]" {...registerField("remember")} />Continuar conectado</label>}
                        {error && <div role="alert" className="rounded-2xl bg-[#fff0ea] px-4 py-3 text-sm text-[#9c3f33]">{error}</div>}
                        <button type="submit" disabled={isLoading || (isRegistering && displayName.trim().length < 2)} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#20251f] font-bold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50">{isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <>{isRegistering ? "criar minha conta" : "entrar"}<ArrowRight className="size-4" /></>}</button>
                    </form>
                    <p className="mt-7 text-center text-sm text-[#71806f]">{isRegistering ? "Já faz parte?" : "Ainda não entrou?"} <button type="button" onClick={() => { setIsRegistering((value) => !value); clearError() }} className="font-bold text-[#20251f] underline decoration-[#d9ff8f] decoration-4 underline-offset-2">{isRegistering ? "Fazer login" : "Criar conta"}</button></p>
                </div>
            </section>
        </div>
    </main>
}
