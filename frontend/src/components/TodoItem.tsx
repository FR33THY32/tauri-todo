import React, { useState, useRef, useEffect } from "react"
import { GripVertical, Pencil, Trash2, Clock } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { Todo } from "@/lib/types"

interface Props {
  todo: Todo
  index: number
  isOpen: boolean
  isFocused: boolean
  onToggle: () => void
  onDelete: () => void
  onExpand: () => void
  onUpdateTitle: (title: string) => void
  onUpdateDescription: (desc: string) => void
  onUpdateDueDate: (date: string | null) => void
  onDragStart: (e: React.MouseEvent) => void
  isDragOver: boolean
  isDragging: boolean
}

function formatDue(dateStr: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr + "T00:00:00")
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { label: diff === -1 ? "Yesterday" : `${Math.abs(diff)}d overdue`, overdue: true, today: false }
  if (diff === 0) return { label: "Today", overdue: false, today: true }
  if (diff === 1) return { label: "Tomorrow", overdue: false, today: false }
  if (diff <= 7) return { label: d.toLocaleDateString("en", { weekday: "short" }), overdue: false, today: false }
  return { label: d.toLocaleDateString("en", { month: "short", day: "numeric" }), overdue: false, today: false }
}

export const TodoItem = React.memo(function TodoItem({
  todo, index, isOpen, isFocused, onToggle, onDelete, onExpand,
  onUpdateTitle, onUpdateDescription, onUpdateDueDate,
  onDragStart, isDragOver, isDragging,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(todo.title)
  const [noteValue, setNoteValue] = useState(todo.description)
  const editRef = useRef<HTMLInputElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const hasNote = todo.description.trim().length > 0
  const due = formatDue(todo.due_date)
  const stagger = Math.min(index + 1, 8)

  useEffect(() => { setNoteValue(todo.description) }, [todo.description])
  useEffect(() => { if (editing) { editRef.current?.focus(); editRef.current?.select() } }, [editing])
  useEffect(() => { if (isOpen) setTimeout(() => noteRef.current?.focus(), 80) }, [isOpen])

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditValue(todo.title)
    setEditing(true)
  }

  const finishEdit = () => {
    setEditing(false)
    const v = editValue.trim()
    if (v && v !== todo.title) onUpdateTitle(v)
  }

  const handleNoteChange = (val: string) => {
    setNoteValue(val)
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => onUpdateDescription(val), 400)
  }

  return (
    <div
      className={cn(
        `glass-card rounded-lg animate-item stagger-${stagger}`,
        "group",
        todo.completed && "opacity-30",
        isOpen && "border-border ring-1 ring-ring/10 shadow-[0_2px_12px_rgba(0,0,0,0.15)]",
        isFocused && "!border-foreground/20 ring-1 ring-foreground/10",
        isDragOver && "!border-foreground/30 ring-2 ring-foreground/12",
        isDragging && "opacity-40",
      )}
      data-id={todo.id}
    >
      {/* Row */}
      <div className="flex items-center gap-2.5 px-3 py-[10px]">
        {/* Drag handle */}
        <div
          className="opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing text-muted-foreground transition-opacity shrink-0"
          onMouseDown={onDragStart}
        >
          <GripVertical className="h-[14px] w-[10px]" />
        </div>

        {/* Check */}
        <Checkbox checked={todo.completed} onCheckedChange={onToggle} className="shrink-0" />

        {/* Content */}
        {editing ? (
          <input
            ref={editRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={finishEdit}
            onKeyDown={e => {
              if (e.key === "Enter") editRef.current?.blur()
              if (e.key === "Escape") { setEditValue(todo.title); setEditing(false) }
            }}
            maxLength={200}
            className="flex-1 h-[28px] px-2 text-[13px] bg-background/40 border border-border/80 rounded-md outline-none focus:ring-1 focus:ring-ring/30"
          />
        ) : (
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onExpand}>
            <p className={cn(
              "text-[13px] font-medium leading-[1.5] break-words",
              todo.completed && "line-through decoration-muted-foreground/30 text-muted-foreground"
            )}>
              {todo.title}
              {hasNote && !isOpen && (
                <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/30 ml-1.5 align-middle" />
              )}
            </p>
            {hasNote && !isOpen && (
              <p className="text-[11.5px] text-muted-foreground/50 truncate mt-0.5">{todo.description}</p>
            )}
            {due && !isOpen && (
              <div className="flex items-center gap-1 mt-1">
                <Clock className="h-[11px] w-[11px]" />
                <span className={cn(
                  "text-[10.5px] font-semibold tracking-[0.2px]",
                  due.overdue && "text-destructive-foreground",
                  due.today && "text-foreground/90",
                  !due.overdue && !due.today && "text-muted-foreground/60",
                )}>
                  {due.label}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <ActionBtn onClick={startEdit}><Pencil className="h-[13px] w-[13px]" /></ActionBtn>
          <ActionBtn onClick={(e) => { e.stopPropagation(); onDelete() }} danger><Trash2 className="h-[13px] w-[13px]" /></ActionBtn>
        </div>
      </div>

      {/* Expandable detail */}
      <div className={cn("expand-grid", isOpen && "open")}>
        <div>
          <div className="px-3 pb-3 pl-[50px] space-y-2">
            {/* Due date */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground">Due</span>
              <input
                type="date"
                value={todo.due_date || ""}
                onChange={e => onUpdateDueDate(e.target.value || null)}
                onClick={e => e.stopPropagation()}
                className="h-[26px] px-2 text-[11.5px] rounded-md border border-border bg-transparent text-foreground outline-none focus:ring-1 focus:ring-ring/30"
                style={{ colorScheme: "inherit" }}
              />
              {todo.due_date && (
                <button
                  onClick={(e) => { e.stopPropagation(); onUpdateDueDate(null) }}
                  className="text-[10px] text-muted-foreground hover:text-destructive-foreground transition-colors"
                >✕</button>
              )}
            </div>

            {/* Note */}
            <textarea
              ref={noteRef}
              value={noteValue}
              onChange={e => handleNoteChange(e.target.value)}
              onClick={e => e.stopPropagation()}
              placeholder="Add a note…"
              rows={3}
              className="w-full min-h-14 max-h-32 px-3 py-2 text-[12.5px] leading-[1.6] bg-background/20 border border-border rounded-lg resize-y outline-none focus:ring-1 focus:ring-ring/30 placeholder:text-muted-foreground/50"
            />
            <p className="text-[10px] text-muted-foreground/40">
              Press <kbd className="px-1 py-0.5 bg-muted border rounded text-[9px] text-muted-foreground">Esc</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </div>
  )
})

function ActionBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-[26px] w-[26px] rounded-[5px] flex items-center justify-center text-muted-foreground/50 transition-all duration-150",
        danger ? "hover:bg-red-500/8 hover:text-red-400" : "hover:bg-glass-hover hover:text-foreground/70"
      )}
    >
      {children}
    </button>
  )
}
