// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backend;

use std::sync::Mutex;
use backend::BackendProcess;
use tauri_plugin_autostart::MacosLauncher;

// 开机自启动相关命令
#[tauri::command]
fn autostart_enable(app_handle: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    app_handle
        .autolaunch()
        .enable()
        .map_err(|e| format!("启用自启动失败: {}", e))
}

#[tauri::command]
fn autostart_disable(app_handle: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    app_handle
        .autolaunch()
        .disable()
        .map_err(|e| format!("禁用自启动失败: {}", e))
}

#[tauri::command]
fn autostart_is_enabled(app_handle: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    app_handle
        .autolaunch()
        .is_enabled()
        .map_err(|e| format!("获取自启动状态失败: {}", e))
}

fn main() {
    // 创建 Backend 进程管理器
    let mut backend = BackendProcess::new();
    
    // 仅在发布模式下自动启动 Backend
    // 开发模式下需要手动在单独终端启动 backend
    #[cfg(not(debug_assertions))]
    {
        println!("🚀 [生产模式] 启动 Backend 服务...");
        let port = 8000;
        if let Err(e) = backend.start(port) {
            eprintln!("❌ 启动 Backend 失败: {}", e);
            // 继续运行，但 Backend 功能不可用
        }
    }
    
    #[cfg(debug_assertions)]
    {
        println!("ℹ️ [开发模式] 请在单独的终端手动启动 Backend:");
        println!("   cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]), // 可选参数：启动时最小化
        ))
        .manage(Mutex::new(backend))
        .invoke_handler(tauri::generate_handler![
            backend::get_backend_status,
            backend::restart_backend,
            autostart_enable,
            autostart_disable,
            autostart_is_enabled,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

