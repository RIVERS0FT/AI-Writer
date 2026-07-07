use std::{fs, path::Path};

const PLACEHOLDER_ICON: &[u8] = &[
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0,
    0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 218, 99,
    252, 207, 192, 80, 15, 0, 4, 255, 1, 254, 67, 166, 114, 85, 0, 0, 0, 0, 73, 69, 78,
    68, 174, 66, 96, 130,
];

fn ensure_placeholder_icon() {
    let icon_path = Path::new("icons/icon.png");
    if icon_path.exists() {
        return;
    }

    fs::create_dir_all("icons").expect("failed to create Tauri icons directory");
    fs::write(icon_path, PLACEHOLDER_ICON).expect("failed to write placeholder Tauri icon");
}

fn main() {
    ensure_placeholder_icon();
    tauri_build::build()
}
