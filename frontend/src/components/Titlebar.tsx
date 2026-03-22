import { getCurrentWindow } from "@tauri-apps/api/window"
import { Moon, Sun, Minus, Square, X } from "lucide-react"

interface Props {
  openCount: number
  theme: string
  onToggleTheme: () => void
}

export function Titlebar({ openCount, theme, onToggleTheme }: Props) {
  const win = getCurrentWindow()
  const label = openCount === 0 ? "All done" : `${openCount} open`

  return (
    <header className="titlebar-drag flex items-center justify-between h-10 px-4 border-b border-border/30 shrink-0 select-none relative z-10">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold tracking-[4px] uppercase text-muted-foreground/60">
          todo
        </span>
        <span className="text-[10px] font-medium text-muted-foreground/30">
          · {label}
        </span>
      </div>

      <div className="titlebar-no-drag flex gap-0.5">
        <TitleBtn onClick={onToggleTheme}>
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </TitleBtn>
        <TitleBtn onClick={() => win.minimize()}>
          <Minus className="h-3 w-3" />
        </TitleBtn>
        <TitleBtn onClick={async () => (await win.isMaximized()) ? win.unmaximize() : win.maximize()}>
          <Square className="h-2.5 w-2.5" />
        </TitleBtn>
        <TitleBtn onClick={() => win.hide()} danger>
          <X className="h-3.5 w-3.5" />
        </TitleBtn>
      </div>
    </header>
  )
}

function TitleBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`
        h-6 w-6 rounded-[5px] flex items-center justify-center
        text-muted-foreground/50 transition-colors duration-200
        hover:text-foreground/80
        ${danger ? "hover:bg-red-500/8 hover:text-red-400" : "hover:bg-glass-hover"}
      `}
    >
      {children}
    </button>
  )
}
