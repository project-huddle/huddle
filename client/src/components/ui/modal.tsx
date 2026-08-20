import { X } from "lucide-react"
import { useEffect, useId, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"

type ModalProps = {
  children: ReactNode
  description?: string
  onClose: () => void
  open: boolean
  title: string
  wide?: boolean
}

export function Modal({ children, description, onClose, open, title, wide = false }: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      if (event.key !== "Tab" || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hasAttribute("hidden"))
      if (!focusable.length) {
        event.preventDefault()
        panelRef.current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    document.body.style.overflow = "hidden"
    requestAnimationFrame(() => panelRef.current?.focus())
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = ""
      previousFocus?.focus()
    }
  }, [onClose, open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-60 grid place-items-center p-4" role="presentation">
      <button className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} aria-label="Fechar modal" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative max-h-[calc(100svh-2rem)] w-full overflow-y-auto rounded-3xl border border-[var(--line)] bg-[var(--canvas)] p-5 text-[var(--ink)] shadow-2xl outline-none sm:p-6 ${wide ? "max-w-6xl" : "max-w-md"}`}
      >
        <div className="mb-5 flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-xl font-black tracking-tight">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-sm text-[var(--muted-text)]">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface)]" aria-label="Fechar">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
