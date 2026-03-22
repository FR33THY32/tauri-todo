interface Props {
  total: number
  open: number
  done: number
}

export function Stats({ total, open, done }: Props) {
  return (
    <div className="flex items-center gap-4">
      <StatItem value={total} label="tasks" />
      <div className="w-px h-4 bg-border/60" />
      <StatItem value={open} label="open" />
      <div className="w-px h-4 bg-border/60" />
      <StatItem value={done} label="done" />
    </div>
  )
}

function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[28px] font-extrabold tracking-tight tabular-nums leading-none transition-all duration-300">
        {value}
      </span>
      <span className="text-[10.5px] font-medium text-muted-foreground tracking-[0.5px]">
        {label}
      </span>
    </div>
  )
}
