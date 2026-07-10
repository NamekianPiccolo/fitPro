"""
build_dist.py - Script untuk menyiapkan folder dist/ untuk Tauri build
Jalankan: python build_dist.py (atau dari scripts/)
"""
import os
import shutil

# Resolve paths relative to project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(BASE_DIR, 'dist')
STATIC_DIST = os.path.join(DIST_DIR, 'static')

def build():
    # 1. Bersihkan dan buat ulang dist/
    if os.path.exists(DIST_DIR):
        shutil.rmtree(DIST_DIR)
    os.makedirs(STATIC_DIST, exist_ok=True)
    print(f"[1/4] Folder '{DIST_DIR}/' dibuat.")

    # 2. Copy dan update index.html
    templates_dir = os.path.join(BASE_DIR, 'templates')
    with open(os.path.join(templates_dir, 'index.html'), 'r', encoding='utf-8') as f:
        html = f.read()

    # Update path dari /static/ ke ./static/ (relatif, tanpa Flask)
    html = html.replace('href="/static/', 'href="./static/')
    html = html.replace('src="/static/', 'src="./static/')

    # Hapus backend status badge (tidak diperlukan lagi)
    html = html.replace(
        '''                <div class="status-badge" id="backend-status">
                    <span class="status-dot warning"></span>
                    <span class="status-text">Connecting to Server...</span>
                </div>
                ''',
        ''
    )

    with open(os.path.join(DIST_DIR, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    print("[2/4] index.html berhasil dibuat di dist/.")

    static_dir = os.path.join(BASE_DIR, 'static')
    files_to_copy = ['style.css', 'model_predict.js', 'script.js']
    for filename in files_to_copy:
        src = os.path.join(static_dir, filename)
        dst = os.path.join(STATIC_DIST, filename)
        if os.path.exists(src):
            shutil.copy2(src, dst)
            size_mb = os.path.getsize(dst) / 1024 / 1024
            print(f"[3/4] Copied {filename} ({size_mb:.1f} MB)")
        else:
            print(f"[!] File tidak ditemukan: {src}")

    vendor_src = os.path.join(static_dir, 'vendor')
    if os.path.exists(vendor_src):
        vendor_dist = os.path.join(STATIC_DIST, 'vendor')
        if os.path.exists(vendor_dist):
            shutil.rmtree(vendor_dist)
        shutil.copytree(vendor_src, vendor_dist)
        print(f"[3/4] Copied vendor directory")

    print("\n[DONE] Build selesai! Folder 'dist/' siap untuk Tauri.")
    print(f"       Jalankan: npm run tauri:build")

if __name__ == '__main__':
    build()
