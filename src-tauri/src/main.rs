#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::{Manager, Runtime, WindowBuilder};

fn open_settings_window<R: Runtime>(manager: &impl Manager<R>) {
    if manager.get_window("settings").is_some() {
        return;
    }

    tauri::WindowBuilder::new(
        manager,
        "settings",
        tauri::WindowUrl::App("settings/".into()),
    )
    .build()
    .unwrap();
}

#[tauri::command]
fn open_settings<R: Runtime>(app: tauri::AppHandle<R>) {
    open_settings_window(&app);
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_settings])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
