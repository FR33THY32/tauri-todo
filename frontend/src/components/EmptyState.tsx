import { FileText, CheckCircle2, Circle, Search } from "lucide-react"
import type { Filter } from "@/lib/types"

interface Props {
  filter: Filter
  isSearch: boolean
}

const states = {
  all:       { icon: FileText,     title: "No tasks",          sub: "Type above to add one" },
  active:    { icon: CheckCircle2, title: "All done!",         sub: "Everything is checked off" },
  completed: { icon: Circle,       title: "Nothing done yet",  sub: "Complete a task to see it here" },
  search:    { icon: Search,       title: "No matches",        sub: "Try a different search" },
}

export function EmptyState({ filter, isSearch }: Props) {
  const key = isSearch ? "search" : filter
  const { icon: Icon, title, sub } = states[key]

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-muted-foreground/20 animate-float">
        <Icon className="h-10 w-10 stroke-[1]" />
      </div>
      <p className="text-[13px] font-bold text-muted-foreground/50">{title}</p>
      <p className="text-[11.5px] text-muted-foreground/35 mt-1">{sub}</p>
    </div>
  )
}
