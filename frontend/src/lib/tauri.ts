import { invoke } from "@tauri-apps/api/core"
import type { Todo, Idea, ListInfo, AppSnapshot } from "./types"

export const api = {
  getSnapshot:       ()                                    => invoke<AppSnapshot>("get_snapshot"),
  getTodos:          ()                                    => invoke<Todo[]>("get_todos"),
  addTodo:           (title: string, dueDate?: string | null, targetListId?: string | null) =>
                     invoke<Todo>("add_todo", { title, dueDate: dueDate ?? null, targetListId: targetListId ?? null }),
  toggleTodo:        (id: string)                          => invoke<Todo>("toggle_todo", { id }),
  updateTodo:        (id: string, title: string)           => invoke<Todo>("update_todo", { id, title }),
  updateDescription: (id: string, description: string)    => invoke<Todo>("update_description", { id, description }),
  updateDueDate:     (id: string, dueDate: string | null)  => invoke<Todo>("update_due_date", { id, dueDate }),
  reorderTodos:      (ids: string[])                       => invoke<Todo[]>("reorder_todos", { ids }),
  deleteTodo:        (id: string)                          => invoke<Todo>("delete_todo", { id }),
  restoreTodo:       (todo: Todo, index: number)           => invoke<Todo[]>("restore_todo", { todo, index }),
  clearCompleted:    ()                                    => invoke<Todo[]>("clear_completed"),
  getLists:          ()                                    => invoke<ListInfo[]>("get_lists"),
  getActiveList:     ()                                    => invoke<string>("get_active_list"),
  switchList:        (id: string)                          => invoke<Todo[]>("switch_list", { id }),
  createList:        (name: string)                        => invoke<ListInfo>("create_list", { name }),
  renameList:        (id: string, name: string)            => invoke<void>("rename_list", { id, name }),
  deleteList:        (id: string)                          => invoke<void>("delete_list", { id }),
  getTheme:          ()                                    => invoke<string>("get_theme"),
  setTheme:          (theme: string)                       => invoke<void>("set_theme", { theme }),
  getIdeas:          ()                                    => invoke<Idea[]>("get_ideas"),
  addIdea:           (text: string)                        => invoke<Idea>("add_idea", { text }),
  deleteIdea:        (id: string)                          => invoke<void>("delete_idea", { id }),
  promoteIdea:       (id: string, listId?: string | null)  => invoke<Todo>("promote_idea", { id, listId: listId ?? null }),
  restoreIdea:       (idea: Idea, index: number)           => invoke<Idea[]>("restore_idea", { idea, index }),
  undoPromote:       (idea: Idea, todoId: string, listId: string) => invoke<void>("undo_promote", { idea, todoId, listId }),
}
