import {
  ArrowUp, ImagePlus, Laugh, LogOut, Mic, MicOff, MonitorUp,
  PhoneCall, PhoneOff, Search, Sparkles, Users, X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"

import { useRealtime } from "@/hooks/use-realtime"
import { api, resolveMediaUrl, type GifResult, type MessageMedia, type User } from "@/lib/api"
import { cn } from "@/lib/utils"

const emojis = ["😀", "😂", "🥹", "😍", "🤔", "😅", "🥳", "😎", "🤝", "👏", "❤️", "🔥", "✨", "🎉", "👍", "👀", "☕", "🌿", "🐸", "🚀"]

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()
}

function Avatar({ user, className }: { user: User; className?: string }) {
  const colors = ["bg-[#f2a65a]", "bg-[#8fb996]", "bg-[#b8a1d9]", "bg-[#e58f8f]", "bg-[#72a6b8]"]
  const color = colors[user.id.charCodeAt(0) % colors.length]
  return <div className={cn("grid size-10 shrink-0 place-items-center rounded-[14px] text-xs font-bold text-[#172019] shadow-sm", color, className)}>{initials(user.displayName)}</div>
}

function RemoteMedia({ audioStream, screenStream, name }: { audioStream: MediaStream | null; screenStream: MediaStream | null; name: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const video = videoRef.current
    const audio = audioRef.current
    if (video) video.srcObject = screenStream
    if (audio) audio.srcObject = audioStream
    return () => {
      if (video) video.srcObject = null
      if (audio) audio.srcObject = null
    }
  }, [audioStream, screenStream])
  return <div className={cn("relative overflow-hidden", screenStream && "rounded-2xl bg-[#18211b]")}>
    <video ref={videoRef} autoPlay playsInline className={cn("w-full", screenStream ? "aspect-video object-contain" : "h-0")} />
    <audio ref={audioRef} autoPlay />
    {screenStream && <span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-3 py-1 text-xs text-white">Tela de {name}</span>}
  </div>
}

export default function ChatPage({ user, token, onLogout }: { user: User; token: string; onLogout: () => void }) {
  const realtime = useRealtime(token)
  const [draft, setDraft] = useState("")
  const [media, setMedia] = useState<MessageMedia | null>(null)
  const [picker, setPicker] = useState<"emoji" | "gif" | null>(null)
  const [gifQuery, setGifQuery] = useState("")
  const [gifs, setGifs] = useState<GifResult[]>([])
  const [gifLoading, setGifLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [realtime.messages])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const content = draft.trim()
    if ((!content && !media) || !realtime.connected) return
    realtime.sendMessage(content, media)
    setDraft("")
    setMedia(null)
    setPicker(null)
  }

  const uploadImage = async (file?: File) => {
    if (!file) return
    setUploading(true)
    realtime.setError(null)
    const form = new FormData()
    form.append("file", file)
    try {
      const result = await api<{ media: MessageMedia }>("/uploads", { method: "POST", body: form }, token)
      setMedia(result.media)
    } catch (cause) {
      realtime.setError(cause instanceof Error ? cause.message : "Não foi possível enviar a imagem.")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const searchGifs = async (event: FormEvent) => {
    event.preventDefault()
    if (!gifQuery.trim()) return
    setGifLoading(true)
    realtime.setError(null)
    try {
      const result = await api<{ results: GifResult[] }>(`/gifs/search?q=${encodeURIComponent(gifQuery.trim())}`, {}, token)
      setGifs(result.results)
    } catch (cause) {
      realtime.setError(cause instanceof Error ? cause.message : "Não foi possível buscar GIFs.")
    } finally {
      setGifLoading(false)
    }
  }

  return <main className="h-svh overflow-hidden bg-[#f3f0e7] text-[#20251f]">
    <div className="mx-auto grid h-full max-w-375 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="flex min-w-0 flex-col border-[#20251f]/10 lg:border-r">
        <header className="flex h-19 shrink-0 items-center gap-3 border-b border-[#20251f]/10 px-4 sm:px-7">
          <div className="grid size-10 rotate-3 place-items-center rounded-[13px] bg-[#20251f] text-[#d9ff8f]"><Sparkles className="size-5" /></div>
          <div>
            <p className="text-lg font-black tracking-[-0.04em]">peniscord</p>
            <p className="text-xs text-[#657064]">a sala da casa · geral</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={cn("hidden rounded-full px-3 py-1.5 text-xs font-semibold sm:inline", realtime.connected ? "bg-[#d9ff8f]" : "bg-[#eadfce]")}>{realtime.connected ? "ao vivo" : "conectando"}</span>
            <button onClick={onLogout} className="grid size-9 place-items-center rounded-full border border-[#20251f]/15 transition hover:bg-white" aria-label="Sair"><LogOut className="size-4" /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-7">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 rounded-[28px] border border-[#20251f]/10 bg-[#d9ff8f] p-6 sm:flex sm:items-end sm:justify-between">
              <div><p className="mb-8 text-xs font-bold uppercase tracking-[0.18em]">Conversa da vez</p><h1 className="max-w-md text-3xl font-black leading-[0.95] tracking-tighter sm:text-4xl">Um canto pequeno para falar de tudo.</h1></div>
              <p className="mt-5 max-w-48 text-sm leading-relaxed text-[#495346] sm:mt-0">Sem canais demais, sem barulho. Só a turma reunida.</p>
            </div>

            <div className="space-y-3">{realtime.messages.map((message) => {
              const mine = message.author.id === user.id
              return <article key={message.id} className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
                <Avatar user={message.author} className="size-8 rounded-[11px]" />
                <div className={cn("max-w-[min(82%,620px)] rounded-[22px] border px-4 py-3 shadow-[0_2px_0_rgba(32,37,31,.08)]", mine ? "rounded-br-md border-[#20251f] bg-[#20251f] text-white" : "rounded-bl-md border-[#20251f]/10 bg-white")}>
                  <div className="mb-1 flex items-center gap-2"><strong className="text-xs">{mine ? "você" : message.author.displayName}</strong><time className={cn("text-[10px]", mine ? "text-white/50" : "text-[#7a8478]")}>{new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time></div>
                  {message.content && <p className="whitespace-pre-wrap wrap-break-word leading-6">{message.content}</p>}
                  {message.media && <img src={resolveMediaUrl(message.media.url)} alt={message.media.alt} loading="lazy" className={cn("mt-2 max-h-105 w-auto max-w-full rounded-xl object-contain", !message.content && "mt-0")} />}
                </div>
              </article>
            })}</div>
            <div ref={endRef} />
          </div>
        </div>

        <div className="shrink-0 px-4 pb-4 sm:px-7 sm:pb-6">
          <div className="relative mx-auto max-w-3xl">
            <div className="mb-2 flex items-center gap-2 lg:hidden">
              {!realtime.inCall ? <button disabled={!realtime.connected || realtime.joining} onClick={realtime.joinCall} className="rounded-full bg-[#20251f] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><PhoneCall className="mr-1.5 inline size-3.5" />{realtime.joining ? "entrando..." : "entrar na chamada"}</button> : <>
                <span className="mr-auto text-xs font-bold">{realtime.peers.length + 1} na chamada</span>
                <button type="button" onClick={realtime.toggleMute} className={cn("grid size-9 place-items-center rounded-full", realtime.muted ? "bg-[#d76b5b] text-white" : "bg-white")}><Mic className="size-4" /></button>
                <button type="button" onClick={realtime.toggleShare} className={cn("grid size-9 place-items-center rounded-full", realtime.sharing ? "bg-[#8fb996]" : "bg-white")}><MonitorUp className="size-4" /></button>
                <button type="button" onClick={realtime.leaveCall} className="grid size-9 place-items-center rounded-full bg-[#d76b5b] text-white"><PhoneOff className="size-4" /></button>
              </>}
            </div>
            {realtime.error && <div className="mb-2 flex items-center rounded-2xl border border-[#d76b5b]/25 bg-[#fff0ea] px-4 py-2.5 text-sm text-[#9c3f33]"><span className="flex-1">{realtime.error}</span><button onClick={() => realtime.setError(null)}><X className="size-4" /></button></div>}

            {picker && <div className="absolute bottom-[calc(100%+10px)] left-0 z-20 w-full max-w-md rounded-[24px] border border-[#20251f]/15 bg-white p-3 shadow-2xl shadow-[#20251f]/15">
              <div className="mb-3 flex items-center justify-between px-1"><strong className="text-sm">{picker === "emoji" ? "Escolha um emoji" : "Buscar GIF"}</strong><button onClick={() => setPicker(null)}><X className="size-4" /></button></div>
              {picker === "emoji" ? <div className="grid grid-cols-7 gap-1 sm:grid-cols-10">{emojis.map((emoji) => <button key={emoji} onClick={() => { setDraft((value) => value + emoji); setPicker(null) }} className="grid aspect-square place-items-center rounded-xl text-2xl hover:bg-[#edf7d8]">{emoji}</button>)}</div> : <>
                <form onSubmit={searchGifs} className="mb-3 flex gap-2"><div className="flex flex-1 items-center gap-2 rounded-xl bg-[#f3f0e7] px-3"><Search className="size-4" /><input value={gifQuery} onChange={(event) => setGifQuery(event.target.value)} placeholder="reação, festa, café..." className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" /></div><button className="rounded-xl bg-[#20251f] px-4 text-sm font-bold text-white">{gifLoading ? "..." : "buscar"}</button></form>
                <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">{gifs.map((gif) => <button key={gif.id} onClick={() => { setMedia({ url: gif.url, type: "gif", alt: gif.alt }); setPicker(null) }} className="overflow-hidden rounded-xl bg-[#eeeae0]"><img src={gif.previewUrl} alt={gif.alt} className="aspect-square size-full object-cover" /></button>)}</div>
                {!gifs.length && <p className="py-7 text-center text-xs text-[#7a8478]">Digite algo para procurar. Requer uma chave Tenor existente.</p>}
              </>}
            </div>}

            {media && <div className="mb-2 inline-flex items-center gap-3 rounded-2xl border border-[#20251f]/10 bg-white p-2 pr-3"><img src={resolveMediaUrl(media.url)} alt={media.alt} className="size-14 rounded-xl object-cover" /><span className="max-w-40 truncate text-xs font-medium">{media.alt}</span><button onClick={() => setMedia(null)} className="grid size-7 place-items-center rounded-full bg-[#f3f0e7]"><X className="size-3.5" /></button></div>}

            <form onSubmit={submit} className="flex items-end gap-1 rounded-[24px] border border-[#20251f]/15 bg-white p-2 shadow-[0_8px_30px_rgba(32,37,31,.08)]">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={(event) => void uploadImage(event.target.files?.[0])} />
              <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="grid size-10 shrink-0 place-items-center rounded-2xl hover:bg-[#edf7d8] disabled:opacity-50" aria-label="Enviar imagem"><ImagePlus className="size-5" /></button>
              <button type="button" onClick={() => setPicker(picker === "emoji" ? null : "emoji")} className="grid size-10 shrink-0 place-items-center rounded-2xl hover:bg-[#edf7d8]" aria-label="Adicionar emoji"><Laugh className="size-5" /></button>
              <button type="button" onClick={() => setPicker(picker === "gif" ? null : "gif")} className="hidden h-10 shrink-0 rounded-2xl px-2 text-xs font-black hover:bg-[#edf7d8] sm:block">GIF</button>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 2000))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} rows={1} placeholder={uploading ? "enviando imagem..." : "escreva do seu jeito"} disabled={!realtime.connected} className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 outline-none placeholder:text-[#939b91]" />
              <button disabled={(!draft.trim() && !media) || !realtime.connected} className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#20251f] text-[#d9ff8f] transition hover:-translate-y-0.5 disabled:opacity-30" aria-label="Enviar"><ArrowUp className="size-5" /></button>
            </form>
          </div>
        </div>
      </section>

      <aside className="hidden min-h-0 flex-col bg-[#ebe6da] lg:flex">
        <div className="border-b border-[#20251f]/10 p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#657064]">Nossa sala</p><div className="mt-4 flex items-center gap-3"><Avatar user={user} /><div className="min-w-0"><p className="truncate font-bold">{user.displayName}</p><p className="text-xs text-[#657064]">você está por aqui</p></div></div></div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-[26px] bg-[#20251f] p-5 text-white">
            <div className="flex items-center"><div className="grid size-10 place-items-center rounded-2xl bg-white/10"><PhoneCall className="size-5" /></div><span className="ml-auto size-2 rounded-full bg-[#d9ff8f]" /></div>
            <h2 className="mt-8 text-2xl font-black tracking-[-0.04em]">Chamada da sala</h2>
            <p className="mt-1 text-sm leading-relaxed text-white/55">Entre quando quiser. Quem estiver por perto aparece aqui.</p>
            {!realtime.inCall ? <button disabled={!realtime.connected || realtime.joining} onClick={realtime.joinCall} className="mt-5 w-full rounded-2xl bg-[#d9ff8f] px-4 py-3 text-sm font-black text-[#20251f] disabled:opacity-50">{realtime.joining ? "entrando..." : "entrar na chamada"}</button> : <>
              <div className="mt-5 flex items-center gap-2 text-sm"><Users className="size-4" /> {realtime.peers.length + 1} na chamada</div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button onClick={realtime.toggleMute} className={cn("grid aspect-square place-items-center rounded-2xl", realtime.muted ? "bg-[#d76b5b]" : "bg-white/10")} aria-label="Alternar microfone">{realtime.muted ? <MicOff /> : <Mic />}</button>
                <button onClick={realtime.toggleShare} className={cn("grid aspect-square place-items-center rounded-2xl", realtime.sharing ? "bg-[#8fb996]" : "bg-white/10")} aria-label="Compartilhar tela"><MonitorUp /></button>
                <button onClick={realtime.leaveCall} className="grid aspect-square place-items-center rounded-2xl bg-[#d76b5b]" aria-label="Sair da chamada"><PhoneOff /></button>
              </div>
            </>}
          </div>
          {realtime.inCall && <div className="mt-5 space-y-3">{realtime.peers.map(({ user: peer, audioStream, screenStream }) => <div key={peer.id}><div className="mb-2 flex items-center gap-2"><Avatar user={peer} className="size-7 rounded-lg" /><span className="text-sm font-semibold">{peer.displayName}</span></div><RemoteMedia audioStream={audioStream} screenStream={screenStream} name={peer.displayName} /></div>)}</div>}
        </div>
        <div className="p-6 text-xs leading-relaxed text-[#7a8478]">Feito para poucas pessoas.<br />Sem algoritmos, sem plateia.</div>
      </aside>
    </div>
  </main>
}
