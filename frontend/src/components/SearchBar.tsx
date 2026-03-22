import { Search, X } from "lucide-react"

interface Props {
  value: string
  onChange: (v: string) => void
}

export function SearchBar({ value, onChange }: Props) {
  return (
    <div className="bg-glass-bg/60 border border-glass-border flex items-center gap-2 h-[32px] px-3 rounded-lg transition-all duration-200 focus-within:border-foreground/12">
      <Search className="h-3 w-3 text-muted-foreground/30 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search tasks…"
        autoComplete="off"
        spellCheck={false}
        className="flex-1 bg-transparent text-[11.5px] tracking-[0.01em] font-medium outline-none placeholder:text-muted-foreground/30 text-foreground"
        id="search-input"
        onKeyDown={e => { if (e.key === "Escape") { onChange(""); (e.target as HTMLInputElement).blur() } }}
      />
      {value && (
        <button onClick={() => onChange("")} className="text-muted-foreground/40 hover:text-foreground hover:bg-glass-hover transition-all p-1 rounded-[4px]">
          <X className="h-[14px] w-[14px]" />
        </button>
      )}
    </div>
  )
}
