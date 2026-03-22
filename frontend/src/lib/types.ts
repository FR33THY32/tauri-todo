export interface Todo {
  id: string
  title: string
  description: string
  due_date: string | null
  completed: boolean
  created_at: string
}

export interface Idea {
  id: string
  text: string
  created_at: string
}

export interface ListInfo {
  id: string
  name: string
  count: number
}

export interface AppSnapshot {
  lists: ListInfo[]
  active_list: string
  todos: Todo[]
  ideas: Idea[]
  theme: string
}

export type Filter = "all" | "active" | "completed"
