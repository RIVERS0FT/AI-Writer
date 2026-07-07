use serde::Serialize;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeInfo {
    name: &'static str,
    version: &'static str,
    platform: &'static str,
    os: &'static str,
    arch: &'static str,
}

#[tauri::command]
fn runtime_info() -> RuntimeInfo {
    RuntimeInfo {
        name: "AI-Writer",
        version: env!("CARGO_PKG_VERSION"),
        platform: "native",
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "content_management_soft_delete",
            sql: include_str!("../migrations/0002_content_management.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "plain_text_only",
            sql: include_str!("../migrations/0003_plain_text_only.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "writing_pipeline_usage",
            sql: include_str!("../migrations/0004_writing_pipeline_usage.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:ai-writer.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path")
                .join("stronghold-salt.txt");

            app.handle().plugin(
                tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build(),
            )?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![runtime_info])
        .run(tauri::generate_context!())
        .expect("error while running AI-Writer");
}
