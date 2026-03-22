import { useState, useEffect, useCallback, useRef } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Toaster, toast } from "sonner"

import { api } from "@/lib/tauri"
import type { Todo, Idea, ListInfo, Filter } from "@/lib/types"
import { Titlebar } from "@/components/Titlebar"
import { ListSwitcher } from "@/components/ListSwitcher"
import { Stats } from "@/components/Stats"
import { AddTodo } from "@/components/AddTodo"
import { SearchBar } from "@/components/SearchBar"
import { FilterTabs } from "@/components/FilterTabs"
import { TodoItem } from "@/components/TodoItem"
import { EmptyState } from "@/components/EmptyState"
import { IdeasView } from "@/components/IdeasView"

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [lists, setLists] = useState<ListInfo[]>([])
  const [activeListId, setActiveListId] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [theme, setTheme] = useState("dark")
  const [kbIndex, setKbIndex] = useState(-1)
  const [kbMode, setKbMode] = useState(false)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [viewMode, setViewMode] = useState<"tasks" | "ideas">("tasks")

  const scrollRef = useRef<HTMLDivElement>(null)
  const undoRef = useRef<{ todo: Todo; index: number } | null>(null)

  // ── Derived ──────────────────────────────────────────────────
  const openCount = todos.filter(t => !t.completed).length
  const doneCount = todos.filter(t => t.completed).length

  const filtered = (() => {
    let items = todos
    if (filter === "active") items = items.filter(t => !t.completed)
    if (filter === "completed") items = items.filter(t => t.completed)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
      )
    }
    return items
  })()

  // ── Load snapshot (single IPC) ────────────────────────────────
  const loadSnapshot = useCallback(async (applyTheme = false) => {
    const snap = await api.getSnapshot()
    if (applyTheme) {
      setTheme(snap.theme)
      document.documentElement.classList.toggle("dark", snap.theme === "dark")
    }
    setLists(snap.lists)
    setActiveListId(snap.active_list)
    setTodos(snap.todos)
    setIdeas(snap.ideas)
  }, [])

  // ── Init ─────────────────────────────────────────────────────
  useEffect(() => { loadSnapshot(true) }, [loadSnapshot])

  // ── Refresh on window focus (picks up Quick Capture changes) ──
  useEffect(() => {
    const win = getCurrentWindow()
    const unlisten = win.onFocusChanged(({ payload: focused }) => {
      if (focused) loadSnapshot()
    })
    return () => { unlisten.then(fn => fn()) }
  }, [loadSnapshot])

  // ── Title sync ───────────────────────────────────────────────
  useEffect(() => {
    if (viewMode === "ideas") {
      const label = ideas.length === 0 ? "No ideas" : `${ideas.length} idea${ideas.length === 1 ? "" : "s"}`
      getCurrentWindow().setTitle(`Todo — ${label}`)
    } else {
      const label = openCount === 0 ? "All done" : `${openCount} open`
      getCurrentWindow().setTitle(`Todo — ${label}`)
    }
  }, [openCount, viewMode, ideas.length])

  // ── Refresh lists helper ─────────────────────────────────────
  const refreshLists = useCallback(async () => {
    setLists(await api.getLists())
  }, [])

  // ── Theme ────────────────────────────────────────────────────
  const toggleTheme = useCallback(async () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    document.documentElement.classList.toggle("dark", next === "dark")
    await api.setTheme(next)
  }, [theme])

  // ── CRUD ─────────────────────────────────────────────────────
  const addTodo = useCallback(async (title: string, dueDate: string | null, targetListId: string | null) => {
    const t = await api.addTodo(title, dueDate, targetListId)
    // If added to a different list, don't show it in current view
    if (targetListId && targetListId !== activeListId) {
      refreshLists()
    } else {
      setTodos(prev => [t, ...prev])
      refreshLists()
    }
  }, [activeListId, refreshLists])

  const toggleTodo = useCallback(async (id: string) => {
    const u = await api.toggleTodo(id)
    setTodos(prev => prev.map(t => t.id === id ? u : t))
    refreshLists()
  }, [refreshLists])

  const deleteTodo = useCallback(async (id: string) => {
    const idx = todos.findIndex(t => t.id === id)
    const deleted = await api.deleteTodo(id)
    setTodos(prev => prev.filter(t => t.id !== id))
    if (expanded === id) setExpanded(null)
    refreshLists()

    undoRef.current = { todo: deleted, index: idx }
    toast("Task deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          if (!undoRef.current) return
          const restored = await api.restoreTodo(undoRef.current.todo, undoRef.current.index)
          setTodos(restored)
          undoRef.current = null
          refreshLists()
        },
      },
      duration: 4000,
    })
  }, [todos, expanded, refreshLists])

  const updateTitle = useCallback(async (id: string, title: string) => {
    const u = await api.updateTodo(id, title)
    setTodos(prev => prev.map(t => t.id === id ? u : t))
  }, [])

  const updateDescription = useCallback(async (id: string, desc: string) => {
    const u = await api.updateDescription(id, desc)
    setTodos(prev => prev.map(t => t.id === id ? u : t))
  }, [])

  const updateDueDate = useCallback(async (id: string, date: string | null) => {
    const u = await api.updateDueDate(id, date)
    setTodos(prev => prev.map(t => t.id === id ? u : t))
  }, [])

  const clearCompleted = useCallback(async () => {
    const remaining = await api.clearCompleted()
    setTodos(remaining)
    setExpanded(null)
    refreshLists()
  }, [refreshLists])

  // ── Ideas ────────────────────────────────────────────────────
  const ideaUndoRef = useRef<{ idea: Idea; index: number } | null>(null)
  const promoteUndoRef = useRef<{ idea: Idea; todoId: string; listId: string } | null>(null)

  const addIdea = useCallback(async (text: string) => {
    const idea = await api.addIdea(text)
    setIdeas(prev => [idea, ...prev])
  }, [])

  const deleteIdea = useCallback(async (id: string) => {
    const idx = ideas.findIndex(i => i.id === id)
    const deleted = ideas.find(i => i.id === id)
    await api.deleteIdea(id)
    setIdeas(prev => prev.filter(i => i.id !== id))

    if (deleted) {
      ideaUndoRef.current = { idea: deleted, index: idx }
      toast("Idea deleted", {
        action: {
          label: "Undo",
          onClick: async () => {
            if (!ideaUndoRef.current) return
            const restored = await api.restoreIdea(ideaUndoRef.current.idea, ideaUndoRef.current.index)
            setIdeas(restored)
            ideaUndoRef.current = null
          },
        },
        duration: 4000,
      })
    }
  }, [ideas])

  const promoteIdea = useCallback(async (id: string) => {
    const idea = ideas.find(i => i.id === id)
    const promoted = await api.promoteIdea(id, activeListId)
    setIdeas(prev => prev.filter(i => i.id !== id))
    refreshLists()
    const listName = lists.find(l => l.id === activeListId)?.name ?? "Personal"

    if (idea) {
      promoteUndoRef.current = { idea, todoId: promoted.id, listId: activeListId }
      toast(`Promoted to ${listName}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            if (!promoteUndoRef.current) return
            const { idea: orig, todoId, listId } = promoteUndoRef.current
            await api.undoPromote(orig, todoId, listId)
            setIdeas(prev => [orig, ...prev])
            promoteUndoRef.current = null
            refreshLists()
          },
        },
        duration: 4000,
      })
    }
  }, [ideas, activeListId, lists, refreshLists])

  // ── Reorder ──────────────────────────────────────────────────
  const reorder = useCallback(async (fromId: string, toId: string) => {
    let newIds: string[] | null = null
    setTodos(prev => {
      const next = [...prev]
      const fi = next.findIndex(t => t.id === fromId)
      const ti = next.findIndex(t => t.id === toId)
      if (fi < 0 || ti < 0) return prev
      const [moved] = next.splice(fi, 1)
      next.splice(ti, 0, moved)
      newIds = next.map(t => t.id)
      return next
    })
    if (newIds) api.reorderTodos(newIds)
  }, [])

  // ── Drag & Drop (pointer-based) ─────────────────────────────
  const dragRef = useRef<{
    id: string; ghost: HTMLDivElement; offsetY: number
  } | null>(null)

  const handleDragStart = useCallback((id: string, e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest("[data-id]") as HTMLElement
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ghost = el.cloneNode(true) as HTMLDivElement
    ghost.style.cssText = `position:fixed;z-index:100;pointer-events:none;width:${rect.width}px;left:${rect.left}px;top:${rect.top}px;opacity:0.85;box-shadow:0 8px 30px rgba(0,0,0,0.3);`
    document.body.appendChild(ghost)
    setDraggingId(id)
    dragRef.current = { id, ghost, offsetY: e.clientY - rect.top }

    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return
      dragRef.current.ghost.style.top = `${me.clientY - dragRef.current.offsetY}px`

      // Find closest item
      const items = document.querySelectorAll("[data-id]")
      let closest: string | null = null
      let minDist = Infinity
      items.forEach(item => {
        const iid = (item as HTMLElement).dataset.id!
        if (iid === id) return
        const r = item.getBoundingClientRect()
        const dist = Math.abs(me.clientY - (r.top + r.height / 2))
        if (dist < minDist) { minDist = dist; closest = iid }
      })
      setDragOverId(closest)

      // Auto scroll
      if (scrollRef.current) {
        const sr = scrollRef.current.getBoundingClientRect()
        if (me.clientY < sr.top + 40) scrollRef.current.scrollTop -= 6
        if (me.clientY > sr.bottom - 40) scrollRef.current.scrollTop += 6
      }
    }

    const onUp = (me: MouseEvent) => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      if (dragRef.current) {
        dragRef.current.ghost.remove()

        // Find drop target
        const items = document.querySelectorAll("[data-id]")
        let closest: string | null = null
        let minDist = Infinity
        items.forEach(item => {
          const iid = (item as HTMLElement).dataset.id!
          if (iid === id) return
          const r = item.getBoundingClientRect()
          const dist = Math.abs(me.clientY - (r.top + r.height / 2))
          if (dist < minDist) { minDist = dist; closest = iid }
        })
        if (closest) reorder(id, closest)

        dragRef.current = null
      }
      setDraggingId(null)
      setDragOverId(null)
    }

    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }, [reorder])

  // ── Lists ────────────────────────────────────────────────────
  const switchList = useCallback(async (id: string) => {
    if (id === activeListId && viewMode === "tasks") return
    if (id === activeListId) {
      // Same list, just switching from ideas → tasks
      setTodos(await api.getTodos())
      setViewMode("tasks")
      setExpanded(null)
      setKbIndex(-1)
      return
    }
    const t = await api.switchList(id)
    setActiveListId(id)
    setTodos(t)
    setViewMode("tasks")
    setExpanded(null)
    setKbIndex(-1)
    refreshLists()
  }, [activeListId, viewMode, refreshLists])

  const createList = useCallback(async () => {
    const name = prompt("List name:")
    if (!name?.trim()) return
    const info = await api.createList(name.trim())
    setActiveListId(info.id)
    setTodos([])
    setExpanded(null)
    setViewMode("tasks")
    refreshLists()
  }, [refreshLists])

  const deleteList = useCallback(async (id: string) => {
    if (!confirm("Delete this list and all its tasks?")) return
    await api.deleteList(id)
    const newLists = await api.getLists()
    const newActive = await api.getActiveList()
    const newTodos = await api.getTodos()
    setLists(newLists)
    setActiveListId(newActive)
    setTodos(newTodos)
    setExpanded(null)
  }, [])

  // ── Keyboard nav ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Global shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault()
        const inputId = viewMode === "ideas" ? "idea-input" : "todo-input"
        document.getElementById(inputId)?.focus()
        setKbMode(false); setKbIndex(-1)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "i") {
        e.preventDefault()
        setViewMode(prev => prev === "ideas" ? "tasks" : "ideas")
        setKbMode(false); setKbIndex(-1)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault()
        const inputId = viewMode === "ideas" ? "idea-search" : "search-input"
        document.getElementById(inputId)?.focus()
        setKbMode(false); setKbIndex(-1)
        return
      }

      // Escape closes expanded anywhere
      if (e.key === "Escape" && expanded) {
        e.preventDefault()
        setExpanded(null)
        ;(document.activeElement as HTMLElement)?.blur()
        return
      }

      const tag = (document.activeElement as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return

      // ── Ideas keyboard nav ──────────────────────────────────
      if (viewMode === "ideas") {
        if (!ideas.length) return

        if (e.key === "ArrowDown" || e.key === "j") {
          e.preventDefault()
          setKbMode(true)
          setKbIndex(prev => Math.min(prev + 1, ideas.length - 1))
        } else if (e.key === "ArrowUp" || e.key === "k") {
          e.preventDefault()
          setKbMode(true)
          setKbIndex(prev => Math.max(prev - 1, 0))
        } else if ((e.key === "d" || e.key === "D") && kbMode && kbIndex >= 0) {
          e.preventDefault()
          deleteIdea(ideas[kbIndex].id)
        } else if ((e.key === "p" || e.key === "P" || e.key === "Enter") && kbMode && kbIndex >= 0) {
          e.preventDefault()
          promoteIdea(ideas[kbIndex].id)
        } else if (e.key === "Escape" && kbMode) {
          setKbMode(false); setKbIndex(-1)
        }
        return
      }

      // ── Tasks keyboard nav ──────────────────────────────────
      if (!filtered.length) return

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault()
        setKbMode(true)
        setKbIndex(prev => Math.min(prev + 1, filtered.length - 1))
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault()
        setKbMode(true)
        setKbIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === " " && kbMode && kbIndex >= 0) {
        e.preventDefault()
        toggleTodo(filtered[kbIndex].id)
      } else if ((e.key === "e" || e.key === "E") && kbMode && kbIndex >= 0) {
        e.preventDefault()
        // Will be handled by TodoItem
      } else if ((e.key === "d" || e.key === "D") && kbMode && kbIndex >= 0) {
        e.preventDefault()
        deleteTodo(filtered[kbIndex].id)
      } else if (e.key === "Enter" && kbMode && kbIndex >= 0) {
        e.preventDefault()
        const id = filtered[kbIndex].id
        setExpanded(prev => prev === id ? null : id)
      } else if (e.key === "Escape" && kbMode) {
        setKbMode(false); setKbIndex(-1)
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [filtered, ideas, kbMode, kbIndex, expanded, viewMode, toggleTodo, deleteTodo, deleteIdea, promoteIdea])

  // Exit kb mode on mouse
  useEffect(() => {
    const handler = () => { if (kbMode) { setKbMode(false); setKbIndex(-1) } }
    window.addEventListener("mousedown", handler)
    return () => window.removeEventListener("mousedown", handler)
  }, [kbMode])

  // Scroll focused item into view
  useEffect(() => {
    if (kbMode && kbIndex >= 0) {
      const el = document.querySelectorAll("[data-id]")[kbIndex]
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [kbIndex, kbMode])

  return (
    <div className="window-shell flex flex-col h-screen border border-border/50 rounded-xl overflow-hidden">
      <Titlebar openCount={openCount} theme={theme} onToggleTheme={toggleTheme} />

      <main className="flex-1 flex flex-col px-5 py-3.5 gap-3 overflow-hidden max-w-[580px] w-full mx-auto relative z-[1]">
        <ListSwitcher
          lists={lists}
          activeListId={activeListId}
          onSwitch={switchList}
          onCreate={createList}
          onDelete={deleteList}
          viewMode={viewMode}
          onSwitchToIdeas={() => setViewMode("ideas")}
          ideaCount={ideas.length}
        />

        {viewMode === "ideas" ? (
          <IdeasView
            ideas={ideas}
            onAdd={addIdea}
            onDelete={deleteIdea}
            onPromote={promoteIdea}
            kbIndex={kbMode ? kbIndex : -1}
          />
        ) : (
          <>
            <Stats total={todos.length} open={openCount} done={doneCount} />
            <AddTodo onAdd={addTodo} lists={lists} />
            <SearchBar value={search} onChange={setSearch} />
            <FilterTabs value={filter} onChange={f => { setFilter(f); setKbIndex(-1) }} />

            {/* List */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pr-1 glass-scroll">
              {filtered.length === 0 ? (
                <EmptyState filter={filter} isSearch={!!search.trim()} />
              ) : (
                filtered.map((todo, idx) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    index={idx}
                    isOpen={expanded === todo.id}
                    isFocused={kbMode && kbIndex === idx}
                    onToggle={() => toggleTodo(todo.id)}
                    onDelete={() => deleteTodo(todo.id)}
                    onExpand={() => setExpanded(prev => prev === todo.id ? null : todo.id)}
                    onUpdateTitle={title => updateTitle(todo.id, title)}
                    onUpdateDescription={desc => updateDescription(todo.id, desc)}
                    onUpdateDueDate={date => updateDueDate(todo.id, date)}
                    onDragStart={e => handleDragStart(todo.id, e)}
                    isDragOver={dragOverId === todo.id}
                    isDragging={draggingId === todo.id}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            {doneCount > 0 && (
              <div className="flex justify-center shrink-0">
                <button
                  onClick={clearCompleted}
                  className="px-3.5 py-[5px] text-[10.5px] font-semibold tracking-[0.3px] text-muted-foreground/40 border border-border/60 rounded-[7px] hover:border-red-500/20 hover:text-red-400 hover:bg-red-500/5 transition-all duration-200"
                >
                  Clear done
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <Toaster
        theme={theme as "dark" | "light"}
        position="bottom-center"
        toastOptions={{
          className: "border-border",
        }}
      />

      {/* Keyboard hint */}
      {kbMode && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-[5px] bg-muted/80 backdrop-blur-md border border-border/60 rounded-[7px] text-[9.5px] font-semibold text-muted-foreground/70 z-50 whitespace-nowrap animate-in fade-in-0 slide-in-from-bottom-1 duration-200 shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
          {viewMode === "ideas" ? (
            <>
              <kbd className="px-[5px] py-px bg-background/50 border border-border/60 rounded-[3px] text-[9px] text-muted-foreground/60">↑↓</kbd> nav{" "}
              <kbd className="px-[5px] py-px bg-background/50 border border-border/60 rounded-[3px] text-[9px] text-muted-foreground/60">P</kbd> promote{" "}
              <kbd className="px-[5px] py-px bg-background/50 border border-border/60 rounded-[3px] text-[9px] text-muted-foreground/60">D</kbd> delete{" "}
              <kbd className="px-[5px] py-px bg-background/50 border border-border/60 rounded-[3px] text-[9px] text-muted-foreground/60">Esc</kbd> exit
            </>
          ) : (
            <>
              <kbd className="px-[5px] py-px bg-background/50 border border-border/60 rounded-[3px] text-[9px] text-muted-foreground/60">↑↓</kbd> nav{" "}
              <kbd className="px-[5px] py-px bg-background/50 border border-border/60 rounded-[3px] text-[9px] text-muted-foreground/60">Space</kbd> toggle{" "}
              <kbd className="px-[5px] py-px bg-background/50 border border-border/60 rounded-[3px] text-[9px] text-muted-foreground/60">E</kbd> edit{" "}
              <kbd className="px-[5px] py-px bg-background/50 border border-border/60 rounded-[3px] text-[9px] text-muted-foreground/60">D</kbd> delete{" "}
              <kbd className="px-[5px] py-px bg-background/50 border border-border/60 rounded-[3px] text-[9px] text-muted-foreground/60">Enter</kbd> expand
            </>
          )}
        </div>
      )}
    </div>
  )
}
