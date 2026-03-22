import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { LogicalSize } from "@tauri-apps/api/dpi"
import { api } from "@/lib/tauri"
import { parseSmartInput } from "@/lib/smart-input"
import type { ListInfo } from "@/lib/types"
import { Calendar, Hash, Zap, Lightbulb, ArrowRight, Check } from "lucide-react"

export default function CaptureApp() {
  const [value, setValue] = useState("")
  const [lists, setLists] = useState<ListInfo[]>([])
  const [activeListId, setActiveListId] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [shaking, setShaking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const win = getCurrentWindow()

  // Load + focus on every show
  useEffect(() => {
    const loadAndFocus = async () => {
      try {
        const [l, a] = await Promise.all([api.getLists(), api.getActiveList()])
        setLists(l)
        setActiveListId(a)
      } catch {}
      setValue("")
      setSubmitted(false)
      setShaking(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }

    loadAndFocus()

    const unlisten = win.onFocusChanged(({ payload: focused }) => {
      if (focused) loadAndFocus()
      else { win.hide(); setValue(""); setSubmitted(false) }
    })

    return () => { unlisten.then(fn => fn()) }
  }, [])

  // ── Mode detection ───────────────────────────────────────────
  const isIdea = value.trimStart().startsWith("!")
  const ideaText = isIdea ? value.trimStart().slice(1).trim() : null

  const parsed = useMemo(() => {
    if (isIdea || !value.trim()) return null
    return parseSmartInput(value)
  }, [value, isIdea])

  const matchedList = useMemo(() => {
    if (!parsed?.listTag) return null
    const tag = parsed.listTag.toLowerCase()
    return lists.find(l => l.name.toLowerCase() === tag) ?? null
  }, [parsed?.listTag, lists])

  const hasTaskChips = !isIdea && parsed && (parsed.dueDateLabel || matchedList || (parsed.listTag && !matchedList))
  const hasChips = hasTaskChips || isIdea
  const hasContent = value.trim().length > 0

  // ── Window resize ────────────────────────────────────────────
  useEffect(() => {
    win.setSize(new LogicalSize(520, hasChips ? 108 : 72))
  }, [hasChips])

  // ── Submit ───────────────────────────────────────────────────
  const submit = useCallback(async () => {
    try {
      if (isIdea) {
        if (!ideaText) {
          setShaking(true)
          setTimeout(() => setShaking(false), 400)
          return
        }
        await api.addIdea(ideaText)
      } else {
        if (!parsed || !parsed.title.trim()) return
        await api.addTodo(parsed.title, parsed.dueDate, matchedList?.id ?? null)
      }
      setSubmitted(true)
      setTimeout(() => {
        win.hide()
        setValue("")
        setSubmitted(false)
      }, 600)
    } catch (err) {
      console.error(err)
    }
  }, [isIdea, ideaText, parsed, matchedList])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit() }
    if (e.key === "Escape") { e.preventDefault(); win.hide(); setValue("") }
  }

  const currentListName = lists.find(l => l.id === activeListId)?.name ?? "Personal"

  // ── Container class ──────────────────────────────────────────
  const barClass = [
    "capture-bar",
    submitted && "capture-success",
    isIdea && !submitted && "capture-idea",
    shaking && "capture-error animate-shake",
  ].filter(Boolean).join(" ")

  return (
    <div className="h-screen flex items-start justify-center">
      <div className={`
        ${barClass}
        w-[calc(100%-16px)] mx-2 mt-2 rounded-2xl overflow-hidden
        transition-transform duration-200
        ${submitted ? "scale-[0.98]" : "scale-100"}
      `}>
        {/* ── Input row ─────────────────────────────────────── */}
        <div className="relative flex items-center h-[56px] pl-[18px] pr-[14px]">

          {/* Mode icon */}
          <div className="relative w-4 h-4 shrink-0 mr-[14px]">
            {submitted ? (
              <Check
                className="absolute inset-0 h-4 w-4 text-emerald-400 animate-check-pop"
                strokeWidth={2.5}
              />
            ) : (
              <>
                <Zap className={`
                  absolute inset-0 h-4 w-4 transition-all duration-200
                  ${isIdea ? "opacity-0 scale-75 rotate-[-30deg]" : "opacity-100 scale-100 rotate-0"}
                  text-white/[0.18]
                `} />
                <Lightbulb className={`
                  absolute inset-0 h-4 w-4 transition-all duration-200
                  ${isIdea ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-75 rotate-[30deg]"}
                  text-amber-400/70 ${isIdea ? "capture-icon-glow" : ""}
                `} />
              </>
            )}
          </div>

          {/* Input or success message */}
          {submitted ? (
            <span className="flex-1 text-[14px] font-semibold tracking-[0.01em] text-emerald-400/90 animate-text-slide">
              {isIdea ? "Idea captured" : "Task added"}
            </span>
          ) : (
            <input
              ref={inputRef}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Add to ${currentListName}…`}
              maxLength={500}
              autoComplete="off"
              spellCheck={false}
              className="
                flex-1 bg-transparent outline-none
                text-[14px] font-medium tracking-[0.01em]
                text-white/90 caret-white/60
                placeholder:text-white/[0.16] placeholder:font-normal
              "
            />
          )}

          {/* Right side: submit button or keyboard hints */}
          {!submitted && hasContent && (
            <button
              onClick={submit}
              className="
                capture-submit shrink-0
                h-[30px] w-[30px] ml-[10px]
                rounded-[8px] bg-white/[0.07]
                flex items-center justify-center
                text-white/40 hover:text-white/80
              "
            >
              <ArrowRight className="h-[14px] w-[14px]" strokeWidth={2} />
            </button>
          )}

          {!submitted && !hasContent && (
            <div className="flex items-center gap-[10px] ml-auto animate-hint">
              <kbd className="
                h-[22px] px-[7px] rounded-[5px]
                bg-white/[0.04] border border-white/[0.06]
                text-[10px] font-semibold text-white/[0.14] tracking-[0.5px]
                flex items-center
              ">!</kbd>
              <span className="text-[10px] font-medium text-white/[0.1] tracking-[0.3px]">idea</span>

              <div className="w-px h-3 bg-white/[0.06]" />

              <kbd className="
                h-[22px] px-[7px] rounded-[5px]
                bg-white/[0.04] border border-white/[0.06]
                text-[10px] font-semibold text-white/[0.14] tracking-[0.5px]
                flex items-center
              ">esc</kbd>
            </div>
          )}
        </div>

        {/* ── Chips row ─────────────────────────────────────── */}
        {hasChips && !submitted && (
          <div>
            <div className="capture-divider mx-[18px]" />
            <div className="flex items-center gap-[8px] pl-[48px] pr-[18px] pt-[8px] pb-[12px]">
              {isIdea && (
                <Chip
                  icon={<Lightbulb className="h-[11px] w-[11px]" />}
                  label="Idea"
                  variant="amber"
                  delay={0}
                />
              )}
              {!isIdea && parsed?.dueDateLabel && (
                <Chip
                  icon={<Calendar className="h-[11px] w-[11px]" />}
                  label={parsed.dueDateLabel}
                  variant="default"
                  delay={0}
                />
              )}
              {!isIdea && matchedList && (
                <Chip
                  icon={<Hash className="h-[11px] w-[11px]" />}
                  label={matchedList.name}
                  variant="default"
                  delay={50}
                />
              )}
              {!isIdea && parsed?.listTag && !matchedList && (
                <Chip
                  icon={<Hash className="h-[11px] w-[11px]" />}
                  label={`${parsed.listTag} — no match`}
                  variant="error"
                  delay={0}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Chip ───────────────────────────────────────────────────────────────── */

function Chip({ icon, label, variant, delay }: {
  icon: React.ReactNode
  label: string
  variant: "default" | "amber" | "error"
  delay: number
}) {
  const colors = {
    default: "bg-white/[0.04] border-white/[0.06] text-white/[0.40]",
    amber:   "bg-amber-500/[0.08] border-amber-400/[0.10] text-amber-400/[0.75]",
    error:   "bg-red-500/[0.08] border-red-400/[0.10] text-red-400/[0.70]",
  }

  return (
    <span
      className={`
        animate-chip inline-flex items-center gap-[5px]
        h-[24px] px-[9px] rounded-[6px]
        border ${colors[variant]}
        text-[10.5px] font-semibold tracking-[0.3px]
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      {icon}
      {label}
    </span>
  )
}
