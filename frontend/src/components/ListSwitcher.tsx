import { ChevronDown, Plus, Trash2, Lightbulb } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ListInfo } from "@/lib/types"

interface Props {
  lists: ListInfo[]
  activeListId: string
  onSwitch: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  viewMode: "tasks" | "ideas"
  onSwitchToIdeas: () => void
  ideaCount: number
}

export function ListSwitcher({
  lists, activeListId, onSwitch, onCreate, onDelete,
  viewMode, onSwitchToIdeas, ideaCount,
}: Props) {
  const current = lists.find(l => l.id === activeListId)
  const isIdeas = viewMode === "ideas"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="glass-card inline-flex items-center gap-1.5 h-[30px] px-[10px] rounded-[7px] text-[12.5px] font-bold text-foreground hover:bg-glass-hover transition-all titlebar-no-drag">
          {isIdeas ? (
            <>
              <Lightbulb className="h-3 w-3 text-amber-500/50" />
              Ideas
            </>
          ) : (
            current?.name ?? "Personal"
          )}
          <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-48 bg-popover/95 backdrop-blur-xl border-border shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
      >
        {lists.map(l => (
          <DropdownMenuItem
            key={l.id}
            className="flex items-center justify-between group cursor-pointer"
            onClick={() => onSwitch(l.id)}
          >
            <span className={`text-[12px] ${!isIdeas && l.id === activeListId ? "font-bold" : "font-medium"}`}>{l.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/50 tabular-nums">{l.count}</span>
              {lists.length > 1 && (
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-0.5 rounded"
                  onClick={(e) => { e.stopPropagation(); onDelete(l.id) }}
                >
                  <Trash2 className="h-[14px] w-[14px]" />
                </button>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onSwitchToIdeas}
          className="flex items-center justify-between cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Lightbulb className="h-3 w-3 text-amber-500/50" />
            <span className={`text-[12px] ${isIdeas ? "font-bold" : "font-medium"}`}>Ideas</span>
          </span>
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">{ideaCount}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreate} className="gap-2 text-muted-foreground/60 cursor-pointer">
          <Plus className="h-3.5 w-3.5" />
          <span className="text-[12px]">New list</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
