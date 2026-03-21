use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, State,
};
use uuid::Uuid;
use chrono::Utc;

// ── Data Model ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub due_date: Option<String>,
    pub completed: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoList {
    pub id: String,
    pub name: String,
    pub todos: Vec<Todo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppStore {
    #[serde(default = "default_active")]
    pub active_list: String,
    #[serde(default = "default_theme")]
    pub theme: String,
    pub lists: Vec<TodoList>,
}

fn default_theme() -> String { "dark".to_string() }

fn default_active() -> String { "default".to_string() }

impl Default for AppStore {
    fn default() -> Self {
        Self {
            active_list: "default".to_string(),
            theme: "dark".to_string(),
            lists: vec![TodoList {
                id: "default".to_string(),
                name: "Personal".to_string(),
                todos: Vec::new(),
            }],
        }
    }
}

// Backwards compat: old format was { todos: [...] }
#[derive(Debug, Deserialize)]
struct LegacyStore {
    todos: Vec<Todo>,
}

pub struct AppState {
    pub store: Mutex<AppStore>,
    pub data_path: Mutex<String>,
}

// ── Persistence ─────────────────────────────────────────────────────────────

fn save_store(state: &AppState) -> Result<(), String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    let path = state.data_path.lock().map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&*store).map_err(|e| e.to_string())?;
    fs::write(&*path, json).map_err(|e| e.to_string())?;
    Ok(())
}

fn load_store(path: &str) -> AppStore {
    let data = match fs::read_to_string(path) {
        Ok(d) => d,
        Err(_) => return AppStore::default(),
    };

    // Try new format first
    if let Ok(store) = serde_json::from_str::<AppStore>(&data) {
        return store;
    }

    // Fall back to legacy { todos: [...] } format
    if let Ok(legacy) = serde_json::from_str::<LegacyStore>(&data) {
        return AppStore {
            active_list: "default".to_string(),
            theme: "dark".to_string(),
            lists: vec![TodoList {
                id: "default".to_string(),
                name: "Personal".to_string(),
                todos: legacy.todos,
            }],
        };
    }

    AppStore::default()
}

// ── Helpers ─────────────────────────────────────────────────────────────────

fn with_active_list<F, R>(state: &AppState, f: F) -> Result<R, String>
where
    F: FnOnce(&mut TodoList) -> Result<R, String>,
{
    let mut store = state.store.lock().map_err(|e| e.to_string())?;
    let active_id = store.active_list.clone();
    let list = store
        .lists
        .iter_mut()
        .find(|l| l.id == active_id)
        .ok_or("Active list not found")?;
    f(list)
}

// ── List Management Commands ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListInfo {
    pub id: String,
    pub name: String,
    pub count: usize,
}

#[tauri::command]
fn get_lists(state: State<AppState>) -> Result<Vec<ListInfo>, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    Ok(store.lists.iter().map(|l| ListInfo {
        id: l.id.clone(),
        name: l.name.clone(),
        count: l.todos.iter().filter(|t| !t.completed).count(),
    }).collect())
}

#[tauri::command]
fn get_active_list(state: State<AppState>) -> Result<String, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    Ok(store.active_list.clone())
}

#[tauri::command]
fn switch_list(id: String, state: State<AppState>) -> Result<Vec<Todo>, String> {
    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        if !store.lists.iter().any(|l| l.id == id) {
            return Err("List not found".to_string());
        }
        store.active_list = id;
    }
    save_store(&state)?;
    get_todos(state)
}

#[tauri::command]
fn create_list(name: String, state: State<AppState>) -> Result<ListInfo, String> {
    let list_id = Uuid::new_v4().to_string();
    let info;
    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        let new_list = TodoList {
            id: list_id.clone(),
            name: name.trim().to_string(),
            todos: Vec::new(),
        };
        info = ListInfo {
            id: new_list.id.clone(),
            name: new_list.name.clone(),
            count: 0,
        };
        store.lists.push(new_list);
        store.active_list = list_id;
    }
    save_store(&state)?;
    Ok(info)
}

#[tauri::command]
fn rename_list(id: String, name: String, state: State<AppState>) -> Result<(), String> {
    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        let list = store.lists.iter_mut().find(|l| l.id == id).ok_or("List not found")?;
        list.name = name.trim().to_string();
    }
    save_store(&state)?;
    Ok(())
}

#[tauri::command]
fn delete_list(id: String, state: State<AppState>) -> Result<(), String> {
    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        if store.lists.len() <= 1 {
            return Err("Cannot delete the last list".to_string());
        }
        store.lists.retain(|l| l.id != id);
        if store.active_list == id {
            store.active_list = store.lists[0].id.clone();
        }
    }
    save_store(&state)?;
    Ok(())
}

// ── Todo Commands ───────────────────────────────────────────────────────────

#[tauri::command]
fn get_todos(state: State<AppState>) -> Result<Vec<Todo>, String> {
    with_active_list(&state, |list| Ok(list.todos.clone()))
}

#[tauri::command]
fn add_todo(title: String, state: State<AppState>) -> Result<Todo, String> {
    let todo = Todo {
        id: Uuid::new_v4().to_string(),
        title: title.trim().to_string(),
        description: String::new(),
        due_date: None,
        completed: false,
        created_at: Utc::now().to_rfc3339(),
    };
    with_active_list(&state, |list| {
        list.todos.insert(0, todo.clone());
        Ok(())
    })?;
    save_store(&state)?;
    Ok(todo)
}

#[tauri::command]
fn toggle_todo(id: String, state: State<AppState>) -> Result<Todo, String> {
    let todo = with_active_list(&state, |list| {
        let item = list.todos.iter_mut().find(|t| t.id == id).ok_or("Todo not found")?;
        item.completed = !item.completed;
        Ok(item.clone())
    })?;
    save_store(&state)?;
    Ok(todo)
}

#[tauri::command]
fn update_todo(id: String, title: String, state: State<AppState>) -> Result<Todo, String> {
    let todo = with_active_list(&state, |list| {
        let item = list.todos.iter_mut().find(|t| t.id == id).ok_or("Todo not found")?;
        item.title = title.trim().to_string();
        Ok(item.clone())
    })?;
    save_store(&state)?;
    Ok(todo)
}

#[tauri::command]
fn update_description(id: String, description: String, state: State<AppState>) -> Result<Todo, String> {
    let todo = with_active_list(&state, |list| {
        let item = list.todos.iter_mut().find(|t| t.id == id).ok_or("Todo not found")?;
        item.description = description.trim().to_string();
        Ok(item.clone())
    })?;
    save_store(&state)?;
    Ok(todo)
}

#[tauri::command]
fn update_due_date(id: String, due_date: Option<String>, state: State<AppState>) -> Result<Todo, String> {
    let todo = with_active_list(&state, |list| {
        let item = list.todos.iter_mut().find(|t| t.id == id).ok_or("Todo not found")?;
        item.due_date = due_date;
        Ok(item.clone())
    })?;
    save_store(&state)?;
    Ok(todo)
}

#[tauri::command]
fn reorder_todos(ids: Vec<String>, state: State<AppState>) -> Result<Vec<Todo>, String> {
    with_active_list(&state, |list| {
        let mut reordered: Vec<Todo> = Vec::with_capacity(ids.len());
        for id in &ids {
            if let Some(todo) = list.todos.iter().find(|t| &t.id == id) {
                reordered.push(todo.clone());
            }
        }
        for todo in &list.todos {
            if !ids.contains(&todo.id) {
                reordered.push(todo.clone());
            }
        }
        list.todos = reordered.clone();
        Ok(reordered)
    })?;
    save_store(&state)?;
    get_todos(state)
}

#[tauri::command]
fn delete_todo(id: String, state: State<AppState>) -> Result<Todo, String> {
    let todo = with_active_list(&state, |list| {
        let idx = list.todos.iter().position(|t| t.id == id).ok_or("Todo not found")?;
        Ok(list.todos.remove(idx))
    })?;
    save_store(&state)?;
    Ok(todo)
}

#[tauri::command]
fn restore_todo(todo: Todo, index: usize, state: State<AppState>) -> Result<Vec<Todo>, String> {
    with_active_list(&state, |list| {
        let idx = index.min(list.todos.len());
        list.todos.insert(idx, todo);
        Ok(())
    })?;
    save_store(&state)?;
    get_todos(state)
}

#[tauri::command]
fn clear_completed(state: State<AppState>) -> Result<Vec<Todo>, String> {
    with_active_list(&state, |list| {
        list.todos.retain(|t| !t.completed);
        Ok(())
    })?;
    save_store(&state)?;
    get_todos(state)
}

// ── Theme Commands ──────────────────────────────────────────────────────────

#[tauri::command]
fn get_theme(state: State<AppState>) -> Result<String, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    Ok(store.theme.clone())
}

#[tauri::command]
fn set_theme(theme: String, state: State<AppState>) -> Result<(), String> {
    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        store.theme = theme;
    }
    save_store(&state)?;
    Ok(())
}

// ── App Entry ───────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // ── Data ────────────────────────────────────────────────────
            let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            fs::create_dir_all(&app_dir).expect("Failed to create app data dir");

            let data_path = app_dir.join("todos.json");
            let data_path_str = data_path.to_string_lossy().to_string();
            let store = load_store(&data_path_str);

            app.manage(AppState {
                store: Mutex::new(store),
                data_path: Mutex::new(data_path_str),
            });

            // ── System Tray ─────────────────────────────────────────────
            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Todo")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_todos,
            add_todo,
            toggle_todo,
            update_todo,
            update_description,
            update_due_date,
            reorder_todos,
            delete_todo,
            restore_todo,
            clear_completed,
            get_lists,
            get_active_list,
            switch_list,
            create_list,
            rename_list,
            delete_list,
            get_theme,
            set_theme,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
