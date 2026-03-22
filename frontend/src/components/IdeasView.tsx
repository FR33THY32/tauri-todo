import React, { useState, useRef, useEffect, useMemo } from "react"
import { Plus, Lightbulb, ArrowRight, Trash2, Search, X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import type { Idea } from "@/lib/types"

interface Props {
  ideas: Idea[]
  onAdd: (text: string) => void
  onDelete: (id: string) => void
  onPromote: (id: string) => void
  kbIndex: number
}

export function IdeasView({ ideas, onAdd, onDelete, onPromote, kbIndex }: Props) {
  const [value, setValue] = useState("")
  const [search, setSearch] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return ideas
    const q = search.toLowerCase()
    return ideas.filter(i => i.text.toLowerCase().includes(q))
  }, [ideas, search])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = value.trim()
    if (!text) return
    onAdd(text)
    setValue("")
    inputRef.current?.focus()
  }

  // Scroll focused item into view
  useEffect(() => {
    if (kbIndex >= 0) {
      const el = document.querySelectorAll("[data-idea-id]")[kbIndex]
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [kbIndex])

  return (
    <>
      {/* Stats */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-[28px] font-extrabold tracking-tight tabular-nums leading-none">
          {ideas.length}
        </span>
        <span className="text-[10.5px] font-medium text-muted-foreground tracking-[0.5px]">
          {ideas.length === 1 ? "idea" : "ideas"}
        </span>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 glass-card rounded-[9px] focus-within:ring-1 focus-within:ring-ring/30 focus-within:border-border transition-all">
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Dump an idea…"
            maxLength={500}
            autoComplete="off"
            spellCheck={false}
            className="w-full h-[42px] px-4 bg-transparent text-[13.5px] font-medium text-foreground placeholder:text-muted-foreground/30 outline-none"
            id="idea-input"
          />
        </div>
        <button
          type="submit"
          className="h-[42px] w-[42px] shrink-0 rounded-[9px] bg-foreground text-background flex items-center justify-center transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-foreground/10 active:scale-95"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>

      {/* Search */}
      <div className="glass-card flex items-center gap-2 h-[32px] px-3 rounded-[7px] focus-within:ring-1 focus-within:ring-ring/30 focus-within:border-border transition-all">
        <Search className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search ideas…"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 bg-transparent text-[11.5px] font-medium outline-none placeholder:text-muted-foreground/40 text-foreground"
          id="idea-search"
          onKeyDown={e => { if (e.key === "Escape") { setSearch(""); (e.target as HTMLInputElement).blur() } }}
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-muted-foreground/40 hover:text-foreground transition-colors p-0.5 rounded">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pr-1 glass-scroll">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 text-muted-foreground/20 animate-float">
              <Lightbulb className="h-10 w-10 stroke-[1]" />
            </div>
            {search.trim() ? (
              <>
                <p className="text-[13px] font-bold text-muted-foreground/50">No matches</p>
                <p className="text-[11.5px] text-muted-foreground/35 mt-1">Try a different search</p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-bold text-muted-foreground/50">No ideas yet</p>
                <p className="text-[11.5px] text-muted-foreground/35 mt-1">
                  Dump your thoughts before they vanish
                </p>
              </>
            )}
          </div>
        ) : (
          filtered.map((idea, idx) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              index={idx}
              isFocused={kbIndex === idx}
              onDelete={() => onDelete(idea.id)}
              onPromote={() => onPromote(idea.id)}
            />
          ))
        )}
      </div>
    </>
  )
}

const IdeaCard = React.memo(function IdeaCard({ idea, index, isFocused, onDelete, onPromote }: {
  idea: Idea
  index: number
  isFocused: boolean
  onDelete: () => void
  onPromote: () => void
}) {
  const stagger = Math.min(index + 1, 8)
  const timeAgo = formatDistanceToNow(new Date(idea.created_at), { addSuffix: true })

  return (
    <div
      className={cn(
        "glass-card rounded-lg animate-item group",
        `stagger-${stagger}`,
        isFocused && "!border-foreground/25 ring-1 ring-foreground/10",
      )}
      data-idea-id={idea.id}
    >
      <div className="flex items-start gap-3 px-3 py-3">
        <Lightbulb className="h-[14px] w-[14px] text-amber-500/35 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium leading-[1.5] break-words whitespace-pre-wrap">
            {idea.text}
          </p>
          <p className="text-[10.5px] text-muted-foreground/35 mt-1.5">{timeAgo}</p>
        </div>
        <div className={cn(
          "flex gap-0.5 transition-opacity shrink-0",
          isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}>
          <button
            onClick={onPromote}
            title="Promote to task"
            aria-label="Promote idea to task"
            className="h-[26px] w-[26px] rounded-[5px] flex items-center justify-center text-muted-foreground/50 hover:text-foreground/70 hover:bg-glass-hover transition-all"
          >
            <ArrowRight className="h-[13px] w-[13px]" />
          </button>
          <button
            onClick={onDelete}
            title="Delete idea"
            aria-label="Delete idea"
            className="h-[26px] w-[26px] rounded-[5px] flex items-center justify-center text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/8 transition-all"
          >
            <Trash2 className="h-[13px] w-[13px]" />
          </button>
        </div>
      </div>
    </div>
  )
})
