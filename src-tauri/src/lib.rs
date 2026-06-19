#[tauri::command]
async fn fetch_tts_audio(text: String) -> Result<Vec<u8>, String> {
    let short_text = if text.len() > 200 { &text[..200] } else { &text };
    let url = format!("https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=id&client=gtx&q={}", urlencoding::encode(short_text));
    
    let client = reqwest::Client::new();
    let response = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Android; Mobile) AppleWebKit/537.36")
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    Ok(bytes.to_vec())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![fetch_tts_audio])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
