import {
  ArrowUp, ImagePlus, Laugh, LogOut, Mic, MicOff, MonitorUp,
  Camera, Hash, Menu, PhoneCall, PhoneOff, Plus, Reply, Search, UserPlus, Users, Video, VideoOff, X,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"

import { useRealtime } from "@/hooks/use-realtime"
import { api, resolveMediaUrl, type GifResult, type HuddleChannel, type HuddleMember, type HuddleServer, type MessageMedia, type User } from "@/lib/api"
import { cn, getInitials } from "@/lib/utils"
import { BrandLogo, BrandMark } from "@/components/brand-logo"
import { CallRoom } from "@/components/call-room"
import { MessageList } from "@/components/message-list"
import { ThemeToggle } from "@/components/theme"
import { Modal } from "@/components/ui/modal"
import { UserAvatar } from "@/components/user-avatar"

const emojis = ["😀", "😂", "🥹", "😍", "🤔", "😅", "🥳", "😎", "🤝", "👏", "❤️", "🔥", "✨", "🎉", "👍", "👀", "☕", "🌿", "🐸", "🚀"]

type TextDialog = "create-server" | "create-channel" | "join-server" | null

export default function ChatPage({ user, token, onLogout }: { user: User; token: string; onLogout: () => void }) {
  const [servers, setServers] = useState<HuddleServer[]>([])
  const [channels, setChannels] = useState<HuddleChannel[]>([])
  const [serverId, setServerId] = useState("")
  const [channelId, setChannelId] = useState("")
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [members, setMembers] = useState<HuddleMember[]>([])
  const [creating, setCreating] = useState(false)
  const [callRoomOpen, setCallRoomOpen] = useState(false)
  const [textDialog, setTextDialog] = useState<TextDialog>(null)
  const [dialogValue, setDialogValue] = useState("")
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const realtime = useRealtime(token, channelId)
  const setRealtimeError = realtime.setError
  const [draft, setDraft] = useState("")
  const [media, setMedia] = useState<MessageMedia | null>(null)
  const [picker, setPicker] = useState<"emoji" | "gif" | null>(null)
  const [gifQuery, setGifQuery] = useState("")
  const [gifs, setGifs] = useState<GifResult[]>([])
  const [gifLoading, setGifLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void api<{ servers: HuddleServer[] }>("/servers", {}, token).then(async ({ servers: found }) => {
      let available = found
      if (!available.length) {
        const created = await api<{ server: HuddleServer; channel: HuddleChannel }>("/servers", { method: "POST", body: JSON.stringify({ name: "Minha comunidade" }) }, token)
        available = [created.server]
      }
      setServers(available)
      setServerId((current) => current || available[0].id)
    }).catch((cause) => setRealtimeError(cause instanceof Error ? cause.message : "Não foi possível carregar os servidores."))
  }, [setRealtimeError, token])

  useEffect(() => {
    if (!serverId) return
    void api<{ channels: HuddleChannel[] }>(`/servers/${serverId}/channels`, {}, token).then(({ channels: found }) => {
      setChannels(found)
      setChannelId((current) => found.some((channel) => channel.id === current) ? current : found[0]?.id ?? "")
    }).catch((cause) => setRealtimeError(cause instanceof Error ? cause.message : "Não foi possível carregar os canais."))
  }, [serverId, setRealtimeError, token])

  useEffect(() => {
    if (!serverId) return
    void api<{ members: HuddleMember[] }>(`/servers/${serverId}/members`, {}, token).then(({ members: found }) => setMembers(found)).catch(() => setMembers([]))
  }, [serverId, token])

  const createServer = async (value?: string) => {
    const name = value?.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const created = await api<{ server: HuddleServer; channel: HuddleChannel }>("/servers", { method: "POST", body: JSON.stringify({ name }) }, token)
      setServers((items) => [...items, created.server])
      setServerId(created.server.id)
      setChannels([created.channel])
      setChannelId(created.channel.id)
      setTextDialog(null)
    } catch (cause) { realtime.setError(cause instanceof Error ? cause.message : "Não foi possível criar o servidor.") }
    finally { setCreating(false) }
  }

  const createTextChannel = async (value?: string) => {
    const name = value?.trim()
    if (!name || !serverId || creating) return
    setCreating(true)
    try {
      const created = await api<{ channel: HuddleChannel }>(`/servers/${serverId}/channels`, { method: "POST", body: JSON.stringify({ name }) }, token)
      setChannels((items) => [...items, created.channel])
      setChannelId(created.channel.id)
      setTextDialog(null)
    } catch (cause) { realtime.setError(cause instanceof Error ? cause.message : "Não foi possível criar o canal.") }
    finally { setCreating(false) }
  }

  const createInvite = async () => {
    if (!serverId) return
    try {
      const result = await api<{ invite: { code: string } }>(`/servers/${serverId}/invites`, { method: "POST" }, token)
      await navigator.clipboard?.writeText(result.invite.code)
      setInviteCode(result.invite.code)
    } catch (cause) { realtime.setError(cause instanceof Error ? cause.message : "Não foi possível criar o convite.") }
  }

  const joinServer = async (value?: string) => {
    const code = value?.trim()
    if (!code) return
    try {
      const result = await api<{ server: HuddleServer }>("/invites/join", { method: "POST", body: JSON.stringify({ code }) }, token)
      setServers((items) => items.some((item) => item.id === result.server.id) ? items : [...items, result.server])
      setServerId(result.server.id)
      setTextDialog(null)
    } catch (cause) { realtime.setError(cause instanceof Error ? cause.message : "Não foi possível entrar no servidor.") }
  }

  const leaveActiveServer = async () => {
    if (!serverId || !window.confirm(`Sair de ${activeServer?.name ?? "este servidor"}?`)) return
    try {
      await api(`/servers/${serverId}/leave`, { method: "POST" }, token)
      const remaining = servers.filter((server) => server.id !== serverId)
      setServers(remaining)
      setServerId(remaining[0]?.id ?? "")
      setChannels([])
      setMembers([])
      setChannelId("")
    } catch (cause) { realtime.setError(cause instanceof Error ? cause.message : "Não foi possível sair do servidor.") }
  }

  const changeMemberRole = async (member: HuddleMember) => {
    if (!serverId || !activeServer || activeServer.ownerId !== user.id || member.isOwner) return
    const nextRole = member.role === "moderator" ? "member" : "moderator"
    try {
      await api(`/servers/${serverId}/members/${member.id}`, { method: "PATCH", body: JSON.stringify({ role: nextRole }) }, token)
      setMembers((items) => items.map((item) => item.id === member.id ? { ...item, role: nextRole } : item))
    } catch (cause) { realtime.setError(cause instanceof Error ? cause.message : "Não foi possível alterar o cargo.") }
  }

  const removeServerMember = async (member: HuddleMember) => {
    if (!serverId || !window.confirm(`Remover ${member.displayName} do servidor?`)) return
    try {
      await api(`/servers/${serverId}/members/${member.id}`, { method: "DELETE" }, token)
      setMembers((items) => items.filter((item) => item.id !== member.id))
    } catch (cause) { realtime.setError(cause instanceof Error ? cause.message : "Não foi possível remover o membro.") }
  }

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [realtime.messages])
  useEffect(() => {
    if (realtime.inCall) setCallRoomOpen(true)
    else setCallRoomOpen(false)
  }, [realtime.inCall])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const content = draft.trim()
    if ((!content && !media) || !realtime.connected) return
    realtime.sendMessage(content, media, replyTo)
    setDraft("")
    setMedia(null)
    setReplyTo(null)
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

  const activeServer = servers.find((server) => server.id === serverId)
  const activeChannel = channels.find((channel) => channel.id === channelId)
  const openTextDialog = (dialog: Exclude<TextDialog, null>) => {
    setDialogValue("")
    setTextDialog(dialog)
  }
  const closeCallRoom = useCallback(() => setCallRoomOpen(false), [])
  const submitTextDialog = (event: FormEvent) => {
    event.preventDefault()
    if (textDialog === "create-server") void createServer(dialogValue)
    if (textDialog === "create-channel") void createTextChannel(dialogValue)
    if (textDialog === "join-server") void joinServer(dialogValue)
  }
  const selectMobileServer = (nextServerId: string) => { setServerId(nextServerId); setMobileNavOpen(false) }
  const selectMobileChannel = (nextChannelId: string) => { setChannelId(nextChannelId); setMobileNavOpen(false) }

  return <main className="chat-page relative h-svh overflow-hidden bg-[var(--canvas)] text-[var(--ink)]">
    <div className="mx-auto grid h-full max-w-375 grid-cols-1 lg:grid-cols-[82px_220px_minmax(0,1fr)_320px]">
      <aside className="hidden flex-col items-center gap-3 border-r border-[var(--ink)]/10 bg-[var(--solid)] py-5 lg:flex">
        <BrandMark className="size-11" />
        {servers.map((server) => <button key={server.id} onClick={() => setServerId(server.id)} title={server.name} className={cn("grid size-11 place-items-center rounded-[15px] text-sm font-black transition", server.id === serverId ? "bg-[var(--brand)] text-[var(--ink)]" : "bg-[var(--surface)]/10 text-[var(--on-solid)] hover:bg-[var(--surface)]/20")}>{getInitials(server.name)}</button>)}
        <button onClick={() => openTextDialog("create-server")} disabled={creating} className="grid size-11 place-items-center rounded-[15px] bg-[var(--surface)]/10 text-[var(--brand)] hover:bg-[var(--surface)]/20" aria-label="Criar servidor"><Plus className="size-5" /></button>
      </aside>
      <aside className="hidden min-h-0 flex-col border-r border-[var(--ink)]/10 bg-[var(--panel)] lg:flex">
        <div className="flex h-19 items-center border-b border-[var(--ink)]/10 px-4"><strong className="truncate text-sm">{activeServer?.name ?? "Servidores"}</strong><div className="ml-auto flex gap-1"><button onClick={() => void createInvite()} className="grid size-8 place-items-center rounded-lg hover:bg-[var(--surface)]" aria-label="Criar convite"><UserPlus className="size-4" /></button><button onClick={() => openTextDialog("join-server")} className="grid size-8 place-items-center rounded-lg hover:bg-[var(--surface)]" aria-label="Entrar com convite"><Users className="size-4" /></button><button onClick={() => void leaveActiveServer()} className="grid size-8 place-items-center rounded-lg hover:bg-[var(--surface)]" aria-label="Sair do servidor"><LogOut className="size-4" /></button><button onClick={() => openTextDialog("create-server")} className="grid size-8 place-items-center rounded-lg hover:bg-[var(--surface)]" aria-label="Criar servidor"><Plus className="size-4" /></button></div></div>
        <div className="p-3"><div className="flex items-center px-2 pb-2"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-text)]">Canais de texto</p><button onClick={() => openTextDialog("create-channel")} className="ml-auto text-[var(--muted-text)] hover:text-[var(--ink)]" aria-label="Criar canal"><Plus className="size-3.5" /></button></div>{channels.map((channel) => <button key={channel.id} onClick={() => setChannelId(channel.id)} className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm", channel.id === channelId ? "bg-[var(--surface)] font-bold shadow-sm" : "text-[var(--muted-text)] hover:bg-[var(--surface)]/60")}><Hash className="size-4" />{channel.name}</button>)}</div>
      </aside>
      <section className="flex min-w-0 flex-col border-[var(--ink)]/10 lg:border-r">
        <header className="flex h-19 shrink-0 items-center gap-3 border-b border-[var(--ink)]/10 px-4 sm:px-7">
          <button onClick={() => setMobileNavOpen(true)} className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--ink)]/10 bg-[var(--surface)] lg:hidden" aria-label="Abrir navegação"><Menu className="size-5" /></button>
          <BrandLogo className="w-28 sm:w-32" />
          <div>
            <p className="text-lg font-black tracking-[-0.04em]">huddle</p>
            <p className="text-xs text-[var(--muted-text)]">{activeServer?.name ?? "sua comunidade"} · #{activeChannel?.name ?? "..."}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={cn("hidden rounded-full px-3 py-1.5 text-xs font-semibold sm:inline", realtime.connected ? "bg-[var(--brand)]" : "bg-[var(--panel)]")}>{realtime.connected ? "ao vivo" : "conectando"}</span>
            <ThemeToggle />
            <button onClick={onLogout} className="grid size-9 place-items-center rounded-full border border-[var(--line)] transition hover:bg-[var(--surface)]" aria-label="Sair"><LogOut className="size-4" /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-7">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 rounded-[28px] border border-[var(--ink)]/10 bg-[var(--brand)] p-6 sm:flex sm:items-end sm:justify-between">
              <div><p className="mb-8 text-xs font-bold uppercase tracking-[0.18em]">Conversa da vez</p><h1 className="max-w-md text-3xl font-black leading-[0.95] tracking-tighter sm:text-4xl">Um canto pequeno para falar de tudo.</h1></div>
              <p className="mt-5 max-w-48 text-sm leading-relaxed text-[var(--muted-text)] sm:mt-0">Sem canais demais, sem barulho. Só a turma reunida.</p>
            </div>

            <MessageList
              currentUserId={user.id}
              messages={realtime.messages}
              onReply={setReplyTo}
              onEdit={realtime.editMessage}
              onDelete={(messageId) => {
                if (window.confirm("Apagar esta mensagem?")) realtime.deleteMessage(messageId)
              }}
              onReact={realtime.reactMessage}
            />
            <div ref={endRef} />
          </div>
        </div>

        <div className="shrink-0 px-4 pb-4 sm:px-7 sm:pb-6">
          <div className="relative mx-auto max-w-3xl">
            <div className="mb-2 flex items-center gap-2 lg:hidden">
              {!realtime.inCall ? <button disabled={!realtime.connected || realtime.joining} onClick={realtime.joinCall} className="rounded-full bg-[var(--solid)] px-4 py-2 text-xs font-bold text-[var(--on-solid)] disabled:opacity-50"><PhoneCall className="mr-1.5 inline size-3.5" />{realtime.joining ? "entrando..." : "entrar na chamada"}</button> : <>
                <button type="button" onClick={() => setCallRoomOpen(true)} className="mr-auto rounded-full bg-[var(--solid)] px-3 py-2 text-xs font-bold text-[var(--on-solid)]">Abrir sala · {realtime.peers.length + 1}</button>
                <button type="button" onClick={realtime.toggleMute} className={cn("grid size-9 place-items-center rounded-full", realtime.muted ? "bg-[#d76b5b] text-[var(--on-solid)]" : "bg-[var(--surface)]")}><Mic className="size-4" /></button>
                <button type="button" onClick={realtime.toggleCamera} className={cn("grid size-9 place-items-center rounded-full", realtime.cameraOff ? "bg-[#d76b5b] text-[var(--on-solid)]" : "bg-[var(--surface)]")}><Camera className="size-4" /></button>
                <button type="button" onClick={realtime.toggleShare} className={cn("grid size-9 place-items-center rounded-full", realtime.sharing ? "bg-[#8fb996]" : "bg-[var(--surface)]")}><MonitorUp className="size-4" /></button>
                <button type="button" onClick={realtime.leaveCall} className="grid size-9 place-items-center rounded-full bg-[#d76b5b] text-[var(--on-solid)]"><PhoneOff className="size-4" /></button>
              </>}
            </div>
            {realtime.error && <div className="mb-2 flex items-center rounded-2xl border border-[#d76b5b]/25 bg-[#fff0ea] px-4 py-2.5 text-sm text-[#9c3f33]"><span className="flex-1">{realtime.error}</span><button onClick={() => realtime.setError(null)}><X className="size-4" /></button></div>}

            {picker && <div className="absolute bottom-[calc(100%+10px)] left-0 z-20 w-full max-w-md rounded-[24px] border border-[var(--ink)]/15 bg-[var(--surface)] p-3 shadow-2xl shadow-[var(--ink)]/15">
              <div className="mb-3 flex items-center justify-between px-1"><strong className="text-sm">{picker === "emoji" ? "Escolha um emoji" : "Buscar GIF"}</strong><button onClick={() => setPicker(null)}><X className="size-4" /></button></div>
              {picker === "emoji" ? <div className="grid grid-cols-7 gap-1 sm:grid-cols-10">{emojis.map((emoji) => <button key={emoji} onClick={() => { setDraft((value) => value + emoji); setPicker(null) }} className="grid aspect-square place-items-center rounded-xl text-2xl hover:bg-[var(--brand-soft)]">{emoji}</button>)}</div> : <>
                <form onSubmit={searchGifs} className="mb-3 flex gap-2"><div className="flex flex-1 items-center gap-2 rounded-xl bg-[var(--canvas)] px-3"><Search className="size-4" /><input value={gifQuery} onChange={(event) => setGifQuery(event.target.value)} placeholder="reação, festa, café..." className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" /></div><button className="rounded-xl bg-[var(--solid)] px-4 text-sm font-bold text-[var(--on-solid)]">{gifLoading ? "..." : "buscar"}</button></form>
                <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">{gifs.map((gif) => <button key={gif.id} onClick={() => { setMedia({ url: gif.url, type: "gif", alt: gif.alt }); setPicker(null) }} className="overflow-hidden rounded-xl bg-[var(--panel)]"><img src={gif.previewUrl} alt={gif.alt} className="aspect-square size-full object-cover" /></button>)}</div>
                {!gifs.length && <p className="py-7 text-center text-xs text-[var(--muted-text)]">Digite algo para procurar. Requer uma chave Tenor existente.</p>}
              </>}
            </div>}

            {replyTo && <div className="mb-2 flex items-center gap-2 rounded-2xl bg-[var(--surface)] px-3 py-2 text-xs"><Reply className="size-3.5" /> Respondendo a uma mensagem <button onClick={() => setReplyTo(null)} className="ml-auto"><X className="size-3.5" /></button></div>}
            {media && <div className="mb-2 inline-flex items-center gap-3 rounded-2xl border border-[var(--ink)]/10 bg-[var(--surface)] p-2 pr-3"><img src={resolveMediaUrl(media.url)} alt={media.alt} className="size-14 rounded-xl object-cover" /><span className="max-w-40 truncate text-xs font-medium">{media.alt}</span><button onClick={() => setMedia(null)} className="grid size-7 place-items-center rounded-full bg-[var(--canvas)]"><X className="size-3.5" /></button></div>}

            <form onSubmit={submit} className="flex items-end gap-1 rounded-[24px] border border-[var(--ink)]/15 bg-[var(--surface)] p-2 shadow-[0_8px_30px_rgba(32,37,31,.08)]">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={(event) => void uploadImage(event.target.files?.[0])} />
              <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="grid size-10 shrink-0 place-items-center rounded-2xl hover:bg-[var(--brand-soft)] disabled:opacity-50" aria-label="Enviar imagem"><ImagePlus className="size-5" /></button>
              <button type="button" onClick={() => setPicker(picker === "emoji" ? null : "emoji")} className="grid size-10 shrink-0 place-items-center rounded-2xl hover:bg-[var(--brand-soft)]" aria-label="Adicionar emoji"><Laugh className="size-5" /></button>
              <button type="button" onClick={() => setPicker(picker === "gif" ? null : "gif")} className="hidden h-10 shrink-0 rounded-2xl px-2 text-xs font-black hover:bg-[var(--brand-soft)] sm:block">GIF</button>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 2000))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} rows={1} placeholder={uploading ? "enviando imagem..." : "escreva do seu jeito"} disabled={!realtime.connected} className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 outline-none placeholder:text-[var(--muted-text)]" />
              <button disabled={(!draft.trim() && !media) || !realtime.connected} className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--solid)] text-[var(--brand)] transition hover:-translate-y-0.5 disabled:opacity-30" aria-label="Enviar"><ArrowUp className="size-5" /></button>
            </form>
          </div>
        </div>
      </section>

      <aside className="hidden min-h-0 flex-col bg-[var(--panel)] lg:flex">
        <div className="border-b border-[var(--ink)]/10 p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-text)]">Nossa sala</p><div className="mt-4 flex items-center gap-3"><UserAvatar user={user} /><div className="min-w-0"><p className="truncate font-bold">{user.displayName}</p><p className="text-xs text-[var(--muted-text)]">você está por aqui</p></div></div></div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-5"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-text)]">Membros · {members.length}</p><button onClick={() => void createInvite()} className="text-[var(--muted-text)] hover:text-[var(--ink)]" aria-label="Criar convite"><UserPlus className="size-4" /></button></div><div className="space-y-2">{members.map((member) => <div key={member.id} className="group flex items-center gap-2"><UserAvatar user={member} className="size-8 rounded-[10px]" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{member.displayName}</p><p className="text-[10px] text-[var(--muted-text)]">{member.role === "owner" ? "proprietário" : member.role === "moderator" ? "moderador" : "membro"}</p></div>{activeServer?.ownerId === user.id && !member.isOwner && <div className="hidden gap-1 group-hover:flex"><button onClick={() => void changeMemberRole(member)} className="rounded px-1.5 py-1 text-[10px] font-bold hover:bg-[var(--surface)]" title="Alternar moderador">{member.role === "moderator" ? "membro" : "mod"}</button><button onClick={() => void removeServerMember(member)} className="rounded px-1.5 py-1 text-[10px] font-bold text-[#b54e42] hover:bg-[#fff0ea]" title="Remover membro">×</button></div>}</div>)}</div></div>
          <div className="rounded-[26px] bg-[var(--solid)] p-5 text-[var(--on-solid)]">
            <div className="flex items-center"><div className="grid size-10 place-items-center rounded-2xl bg-[var(--surface)]/10"><PhoneCall className="size-5" /></div><span className="ml-auto size-2 rounded-full bg-[var(--brand)]" /></div>
            <h2 className="mt-8 text-2xl font-black tracking-[-0.04em]">Chamada da sala</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--on-solid)]/55">Entre quando quiser. Quem estiver por perto aparece aqui.</p>
            {!realtime.inCall ? <button disabled={!realtime.connected || realtime.joining} onClick={realtime.joinCall} className="mt-5 w-full rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-black text-[var(--ink)] disabled:opacity-50">{realtime.joining ? "entrando..." : "entrar na chamada"}</button> : <>
              <div className="mt-5 flex items-center gap-2 text-sm"><Users className="size-4" /> {realtime.peers.length + 1} na chamada</div>
              <button onClick={() => setCallRoomOpen(true)} className="mt-3 w-full rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-black text-[var(--ink)]">Abrir sala da chamada</button>
              <div className="mt-3 grid grid-cols-4 gap-2">
                <button onClick={realtime.toggleMute} className={cn("grid aspect-square place-items-center rounded-2xl", realtime.muted ? "bg-[#d76b5b]" : "bg-[var(--surface)]/10")} aria-label="Alternar microfone">{realtime.muted ? <MicOff /> : <Mic />}</button>
                <button onClick={realtime.toggleCamera} className={cn("grid aspect-square place-items-center rounded-2xl", realtime.cameraOff ? "bg-[#d76b5b]" : "bg-[var(--surface)]/10")} aria-label="Alternar câmera">{realtime.cameraOff ? <VideoOff /> : <Video />}</button>
                <button onClick={realtime.toggleShare} className={cn("grid aspect-square place-items-center rounded-2xl", realtime.sharing ? "bg-[#8fb996]" : "bg-[var(--surface)]/10")} aria-label="Compartilhar tela"><MonitorUp /></button>
                <button onClick={realtime.leaveCall} className="grid aspect-square place-items-center rounded-2xl bg-[#d76b5b]" aria-label="Sair da chamada"><PhoneOff /></button>
              </div>
            </>}
          </div>
          {realtime.inCall && <div className="mt-5 space-y-2">{realtime.peers.map(({ user: peer, sharing }) => <button type="button" onClick={() => setCallRoomOpen(true)} key={peer.id} className="flex w-full items-center gap-2 rounded-xl p-2 text-left hover:bg-[var(--surface)]"><UserAvatar user={peer} className="size-7 rounded-lg" /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{peer.displayName}</span>{sharing && <MonitorUp className="size-4 text-[var(--brand)]" />}</button>)}</div>}
        </div>
        <div className="p-6 text-xs leading-relaxed text-[var(--muted-text)]">Feito para poucas pessoas.<br />Sem algoritmos, sem plateia.</div>
      </aside>
    </div>
    {mobileNavOpen && <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navegação do servidor">
      <button className="absolute inset-0 bg-[var(--solid)]/45 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} aria-label="Fechar navegação" />
      <aside className="relative flex h-full w-[min(88vw,360px)] flex-col bg-[var(--panel)] shadow-2xl">
        <div className="flex h-19 shrink-0 items-center gap-3 border-b border-[var(--ink)]/10 px-4"><BrandMark className="size-10" /><div className="min-w-0 flex-1"><p className="truncate font-black">{activeServer?.name ?? "huddle"}</p><p className="text-xs text-[var(--muted-text)]">navegação</p></div><button onClick={() => setMobileNavOpen(false)} className="grid size-9 place-items-center rounded-xl bg-[var(--surface)]" aria-label="Fechar"><X className="size-4" /></button></div>
        <div className="flex min-h-0 flex-1">
          <div className="flex w-18 shrink-0 flex-col items-center gap-3 bg-[var(--solid)] py-4"><BrandMark className="size-10" />{servers.map((server) => <button key={server.id} onClick={() => selectMobileServer(server.id)} title={server.name} className={cn("grid size-10 place-items-center rounded-[13px] text-xs font-black", server.id === serverId ? "bg-[var(--brand)] text-[var(--ink)]" : "bg-[var(--surface)]/10 text-[var(--on-solid)]")}>{getInitials(server.name)}</button>)}<button onClick={() => openTextDialog("create-server")} className="grid size-10 place-items-center rounded-[13px] bg-[var(--surface)]/10 text-[var(--brand)]" aria-label="Criar servidor"><Plus className="size-4" /></button></div>
          <div className="min-w-0 flex-1 overflow-y-auto p-4"><div className="mb-5 flex items-center gap-2"><strong className="min-w-0 flex-1 truncate">{activeServer?.name ?? "Servidor"}</strong><button onClick={() => void createInvite()} className="grid size-8 place-items-center rounded-lg bg-[var(--surface)]" aria-label="Criar convite"><UserPlus className="size-4" /></button><button onClick={() => openTextDialog("join-server")} className="grid size-8 place-items-center rounded-lg bg-[var(--surface)]" aria-label="Entrar com convite"><Users className="size-4" /></button></div><div className="mb-6"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-text)]">Canais</p><button onClick={() => openTextDialog("create-channel")} aria-label="Criar canal"><Plus className="size-4" /></button></div>{channels.map((channel) => <button key={channel.id} onClick={() => selectMobileChannel(channel.id)} className={cn("mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm", channel.id === channelId ? "bg-[var(--surface)] font-bold shadow-sm" : "text-[var(--muted-text)] hover:bg-[var(--surface)]/60")}><Hash className="size-4" />{channel.name}</button>)}</div><div><p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-text)]">Membros · {members.length}</p>{members.map((member) => <div key={member.id} className="mb-3 flex items-center gap-2"><UserAvatar user={member} className="size-8 rounded-[10px]" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{member.displayName}</p><p className="text-[10px] text-[var(--muted-text)]">{member.role === "owner" ? "proprietário" : member.role === "moderator" ? "moderador" : "membro"}</p></div></div>)}</div></div>
        </div>
      </aside>
    </div>}
    <CallRoom
      open={callRoomOpen}
      onClose={closeCallRoom}
      inCall={realtime.inCall}
      user={user}
      peers={realtime.peers}
      muted={realtime.muted}
      cameraOff={realtime.cameraOff}
      sharing={realtime.sharing}
      localMediaStream={realtime.localMediaStream}
      localDisplayStream={realtime.localDisplayStream}
      onToggleMute={realtime.toggleMute}
      onToggleCamera={realtime.toggleCamera}
      onToggleShare={realtime.toggleShare}
      onLeave={realtime.leaveCall}
    />
    <Modal
      open={textDialog !== null}
      onClose={() => setTextDialog(null)}
      title={textDialog === "create-server" ? "Criar servidor" : textDialog === "create-channel" ? "Criar canal" : "Entrar em um servidor"}
      description={textDialog === "join-server" ? "Cole o código de convite que você recebeu." : "Escolha um nome curto e fácil de reconhecer."}
    >
      <form onSubmit={submitTextDialog}>
        <label htmlFor="dialog-value" className="text-sm font-bold">{textDialog === "join-server" ? "Código do convite" : "Nome"}</label>
        <input
          id="dialog-value"
          autoFocus
          value={dialogValue}
          onChange={(event) => setDialogValue(event.target.value)}
          maxLength={textDialog === "join-server" ? 100 : 60}
          placeholder={textDialog === "create-server" ? "Minha comunidade" : textDialog === "create-channel" ? "geral" : "Ex.: ABC123"}
          className="mt-2 h-12 w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 outline-none focus:ring-2 focus:ring-[var(--brand)]"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setTextDialog(null)} className="rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-[var(--surface)]">Cancelar</button>
          <button disabled={!dialogValue.trim() || creating} className="rounded-xl bg-[var(--solid)] px-4 py-2.5 text-sm font-bold text-[var(--on-solid)] disabled:opacity-40">
            {creating ? "Salvando..." : textDialog === "join-server" ? "Entrar" : "Criar"}
          </button>
        </div>
      </form>
    </Modal>
    <Modal open={inviteCode !== null} onClose={() => setInviteCode(null)} title="Convite criado" description="O código já foi copiado para a área de transferência.">
      <div className="rounded-2xl bg-[var(--surface)] p-4 text-center font-mono text-lg font-black tracking-wider">{inviteCode}</div>
      <button type="button" onClick={() => void navigator.clipboard?.writeText(inviteCode ?? "")} className="mt-4 w-full rounded-xl bg-[var(--solid)] px-4 py-3 text-sm font-bold text-[var(--on-solid)]">Copiar código</button>
    </Modal>
  </main>
}
