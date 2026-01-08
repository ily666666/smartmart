// Backend 进程管理模块

use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

pub struct BackendProcess {
    child: Option<Child>,
}

impl BackendProcess {
    pub fn new() -> Self {
        Self { child: None }
    }

    pub fn start(&mut self, port: u16) -> Result<(), String> {
        println!("🚀 启动 Backend 服务...");
        println!("   端口: {}", port);

        // 获取 backend.exe 路径（尝试多个位置）
        let exe_dir = std::env::current_exe()
            .map_err(|e| format!("获取程序路径失败: {}", e))?
            .parent()
            .ok_or("无法获取父目录")?
            .to_path_buf();

        // 尝试多个可能的路径：
        // 1. 同级目录（开发/便携模式）
        // 2. resources 子目录（Tauri 打包后的位置）
        let possible_paths = [
            exe_dir.join("smartmart-backend.exe"),
            exe_dir.join("resources").join("smartmart-backend.exe"),
        ];

        let resource_path = possible_paths
            .iter()
            .find(|p| p.exists())
            .ok_or_else(|| {
                format!(
                    "Backend 可执行文件不存在，已尝试路径:\n  - {:?}\n  - {:?}",
                    possible_paths[0], possible_paths[1]
                )
            })?
            .clone();

        println!("   路径: {:?}", resource_path);

        // 启动 backend 进程
        let child = Command::new(resource_path)
            .args(&[
                "--host", "0.0.0.0",
                "--port", &port.to_string(),
            ])
            .spawn()
            .map_err(|e| format!("启动 Backend 失败: {}", e))?;

        self.child = Some(child);

        println!("✅ Backend 服务已启动");
        Ok(())
    }

    pub fn stop(&mut self) {
        if let Some(mut child) = self.child.take() {
            println!("🛑 停止 Backend 服务...");
            let _ = child.kill();
            let _ = child.wait();
            println!("✅ Backend 服务已停止");
        }
    }
}

impl Drop for BackendProcess {
    fn drop(&mut self) {
        self.stop();
    }
}

// Tauri 命令

#[tauri::command]
pub fn get_backend_status() -> Result<String, String> {
    Ok("running".to_string())
}

#[tauri::command]
pub async fn restart_backend(port: u16, app_handle: tauri::AppHandle) -> Result<(), String> {
    let backend_state = app_handle.state::<Mutex<BackendProcess>>();
    let mut backend = backend_state.lock().unwrap();
    
    backend.stop();
    std::thread::sleep(std::time::Duration::from_secs(1));
    backend.start(port)?;
    
    Ok(())
}


