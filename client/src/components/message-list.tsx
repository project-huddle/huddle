import { Pencil, Reply, Trash2 } from "lucide-react"
import { useState, type FormEvent, type ReactElement } from "react"

import { Modal } from "@/components/ui/modal"
import { UserAvatar } from "@/components/user-avatar"
import { resolveMediaUrl, type ChatMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

type MessageListProps = {
  currentUserId: string
  messages: ChatMessage[]
  onDelete: (messageId: string) => void
  onEdit: (messageId: string, content: string) => void
  onReact: (messageId: string, emoji: string) => void
  onReply: (messageId: string) => void
}

export function MessageList({ currentUserId, messages, onDelete, onEdit, onReact, onReply }: MessageListProps) {
  const [editing, setEditing] = useState<ChatMessage | null>(null)
  const [editValue, setEditValue] = useState("")

  const startEditing = (message: ChatMessage) => {
    setEditing(message)
    setEditValue(message.content)
  }

  const submitEdit = (event: FormEvent) => {
    event.preventDefault()
    if (!editing || !editValue.trim()) return
    onEdit(editing.id, editValue.trim())
    setEditing(null)
  }

  return (
    <>
      <div className="space-y-3">
        {messages.map((message) => {
          const mine = message.author.id === currentUserId

          return (
            <article key={message.id} className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
              <UserAvatar user={message.author} className="size-8 rounded-[11px]" />
              <div className={cn(
                "group relative max-w-[min(82%,620px)] rounded-[22px] border px-4 py-3 shadow-[0_2px_0_rgba(32,37,31,.08)]",
                mine
                  ? "rounded-br-md border-[var(--ink)] bg-[var(--solid)] text-[var(--on-solid)]"
                  : "rounded-bl-md border-[var(--ink)]/10 bg-[var(--surface)]",
              )}>
                <div className="mb-1 flex items-center gap-2">
                  <strong className="text-xs">{mine ? "você" : message.author.displayName}</strong>
                  <time className={cn("text-[10px]", mine ? "text-[var(--on-solid)]/50" : "text-[var(--muted-text)]")}>
                    {new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </time>
                </div>
                {message.replyToId && <p className="mb-2 border-l-2 border-[var(--brand)] pl-2 text-xs opacity-60">respondendo a uma mensagem</p>}
                {message.deletedAt ? (
                  <p className="italic opacity-50">mensagem apagada</p>
                ) : message.content && (
                  <p className="whitespace-pre-wrap wrap-break-word leading-6">
                    {message.content}
                    {message.editedAt && <span className="ml-1 text-[10px] opacity-50">(editada)</span>}
                  </p>
                )}
                {message.media && (
                  <img src={resolveMediaUrl(message.media.url)} alt={message.media.alt} loading="lazy" className={cn("mt-2 max-h-105 w-auto max-w-full rounded-xl object-contain", !message.content && "mt-0")} />
                )}
                {!message.deletedAt && (
                  <div className="mt-2 flex items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    <ActionButton label="Responder" onClick={() => onReply(message.id)}><Reply /></ActionButton>
                    {mine && (
                      <>
                        <ActionButton label="Editar" onClick={() => startEditing(message)}><Pencil /></ActionButton>
                        <ActionButton label="Apagar" onClick={() => onDelete(message.id)}><Trash2 /></ActionButton>
                      </>
                    )}
                    <button onClick={() => onReact(message.id, "👍")} className="rounded px-1 text-xs hover:bg-[var(--surface)]/20" aria-label="Reagir com joinha">👍</button>
                    <button onClick={() => onReact(message.id, "❤️")} className="rounded px-1 text-xs hover:bg-[var(--surface)]/20" aria-label="Reagir com coração">❤️</button>
                  </div>
                )}
                {Object.keys(message.reactions).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(message.reactions).map(([emoji, count]) => (
                      <button key={emoji} onClick={() => onReact(message.id, emoji)} className="rounded-full bg-[var(--brand)]/30 px-2 py-0.5 text-xs">{emoji} {count}</button>
                    ))}
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Editar mensagem" description="Revise o texto antes de salvar.">
        <form onSubmit={submitEdit}>
          <textarea autoFocus value={editValue} onChange={(event) => setEditValue(event.target.value.slice(0, 2000))} rows={5} className="w-full resize-y rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 outline-none focus:ring-2 focus:ring-[var(--brand)]" />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(null)} className="rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-[var(--surface)]">Cancelar</button>
            <button disabled={!editValue.trim()} className="rounded-xl bg-[var(--solid)] px-4 py-2.5 text-sm font-bold text-[var(--on-solid)] disabled:opacity-40">Salvar</button>
          </div>
        </form>
      </Modal>
    </>
  )
}

function ActionButton({ children, label, onClick }: { children: ReactElement; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="rounded p-1 hover:bg-[var(--surface)]/20 [&_svg]:size-3.5" title={label} aria-label={label}>{children}</button>
}
