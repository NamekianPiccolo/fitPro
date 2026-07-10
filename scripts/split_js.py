import os

def split():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    script_path = os.path.join(base_dir, 'static', 'script.js')
    
    with open(script_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Hapus wrapper DOMContentLoaded
    start_wrapper = "document.addEventListener('DOMContentLoaded', () => {"
    if content.startswith(start_wrapper):
        content = content[len(start_wrapper):].strip()
        # Remove last });
        if content.endswith("});"):
            content = content[:-3].strip()

    # Cari batas tiap seksi
    sec1 = content.find("// 1. DOM Elements")
    sec2 = content.find("// 2. Mathematical Utility")
    sec3 = content.find("// 3. ML Prediction")
    sec5 = content.find("// 5. UI Updating")
    sec6 = content.find("// 6. MediaPipe Pose Processor")

    state_code = content[sec1:sec2].strip()
    utils_code = content[sec2:sec3].strip()
    tracker_code = content[sec3:sec5].strip()
    ui_code = content[sec5:sec6].strip()
    main_code = content[sec6:].strip()

    js_dir = os.path.join(base_dir, 'static', 'js')
    os.makedirs(js_dir, exist_ok=True)

    with open(os.path.join(js_dir, 'state.js'), 'w', encoding='utf-8') as f:
        f.write(state_code)
        
    with open(os.path.join(js_dir, 'utils.js'), 'w', encoding='utf-8') as f:
        f.write(utils_code)

    with open(os.path.join(js_dir, 'tracker.js'), 'w', encoding='utf-8') as f:
        f.write(tracker_code)

    with open(os.path.join(js_dir, 'ui.js'), 'w', encoding='utf-8') as f:
        f.write(ui_code)

    with open(os.path.join(js_dir, 'main.js'), 'w', encoding='utf-8') as f:
        f.write(main_code)

    print("Berhasil dipecah!")

if __name__ == "__main__":
    split()
