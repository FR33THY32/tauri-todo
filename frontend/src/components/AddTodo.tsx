import { useState, useRef, useMemo } from "react"
import { Plus, Calendar, Hash } from "lucide-react"
import { parseSmartInput } from "@/lib/smart-input"
import type { ListInfo } from "@/lib/types"

interface Props {
  onAdd: (title: string, dueDate: string | null, targetListId: string | null) => void
  lists: ListInfo[]
}

export function AddTodo({ onAdd, lists }: Props) {
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => {
    if (!value.trim()) return null
    return parseSmartInput(value)
  }, [value])

  // Resolve list tag to actual list
  const matchedList = useMemo(() => {
    if (!parsed?.listTag) return null
    const tag = parsed.listTag.toLowerCase()
    return lists.find(l => l.name.toLowerCase() === tag) ?? null
  }, [parsed?.listTag, lists])

  const hasChips = parsed && (parsed.dueDateLabel || matchedList)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!parsed || !parsed.title) return
    onAdd(parsed.title, parsed.dueDate, matchedList?.id ?? null)
    setValue("")
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-0">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 bg-glass-bg/80 border border-glass-border rounded-lg transition-all duration-200 focus-within:border-foreground/15 focus-within:shadow-[0_0_0_3px_rgba(255,255,255,0.03)]">
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder='Add task… try "Buy milk tomorrow #personal"'
            maxLength={200}
            autoComplete="off"
            spellCheck={false}
            className="w-full h-[42px] px-4 bg-transparent text-[13.5px] tracking-[0.01em] font-medium text-foreground caret-foreground/50 placeholder:text-muted-foreground/25 placeholder:font-normal outline-none"
            id="todo-input"
          />
        </div>
        <button
          type="submit"
          className="h-[42px] w-[42px] shrink-0 rounded-[9px] bg-foreground text-background flex items-center justify-center shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md hover:shadow-foreground/5 active:scale-95"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>

      {/* Live parse preview */}
      {hasChips && (
        <div className="flex items-center gap-1.5 px-1 pt-2">
          {parsed.dueDateLabel && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-foreground/8 bg-foreground/10 text-[10.5px] tracking-[0.3px] font-semibold text-foreground/70 animate-in fade-in-0 slide-in-from-top-1 duration-200">
              <Calendar className="h-3 w-3" />
              {parsed.dueDateLabel}
            </span>
          )}
          {matchedList && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-foreground/8 bg-foreground/10 text-[10.5px] tracking-[0.3px] font-semibold text-foreground/70 animate-in fade-in-0 slide-in-from-top-1 duration-200">
              <Hash className="h-3 w-3" />
              {matchedList.name}
            </span>
          )}
          {parsed.listTag && !matchedList && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-foreground/8 bg-destructive/8 text-[10.5px] tracking-[0.3px] font-semibold text-destructive-foreground/70 animate-in fade-in-0 slide-in-from-top-1 duration-200">
              <Hash className="h-3 w-3" />
              {parsed.listTag} — no match
            </span>
          )}
        </div>
      )}
    </div>
  )
}
