import type { Filter } from "@/lib/types"

interface Props {
  value: Filter
  onChange: (f: Filter) => void
}

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Done" },
]

export function FilterTabs({ value, onChange }: Props) {
  return (
    <div className="flex gap-0.5 p-[3px] rounded-[9px] border border-border bg-muted/30 backdrop-blur-sm">
      {filters.map(f => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={`
            flex-1 py-1.5 rounded-md text-[11px] tracking-[0.3px] font-semibold cursor-pointer transition-all duration-200
            ${value === f.value
              ? "bg-glass-bg text-foreground border border-glass-border backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
              : "text-muted-foreground/60 hover:text-foreground/80 border border-transparent"
            }
          `}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
