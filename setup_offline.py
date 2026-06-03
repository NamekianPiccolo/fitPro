import os
import shutil

def copy_dir(src, dst):
    if os.path.exists(dst):
        shutil.rmtree(dst)
    shutil.copytree(src, dst)

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    node_modules = os.path.join(base_dir, 'node_modules')
    vendor_dir = os.path.join(base_dir, 'static', 'vendor')
    
    if not os.path.exists(vendor_dir):
        os.makedirs(vendor_dir)

    print("Copying MediaPipe Pose...")
    copy_dir(os.path.join(node_modules, '@mediapipe', 'pose'), os.path.join(vendor_dir, 'mediapipe', 'pose'))
    
    print("Copying MediaPipe Camera Utils...")
    copy_dir(os.path.join(node_modules, '@mediapipe', 'camera_utils'), os.path.join(vendor_dir, 'mediapipe', 'camera_utils'))
    
    print("Copying FontAwesome...")
    fontawesome_src = os.path.join(node_modules, '@fortawesome', 'fontawesome-free')
    fontawesome_dst = os.path.join(vendor_dir, 'fontawesome')
    if os.path.exists(fontawesome_dst):
        shutil.rmtree(fontawesome_dst)
    os.makedirs(fontawesome_dst)
    shutil.copytree(os.path.join(fontawesome_src, 'css'), os.path.join(fontawesome_dst, 'css'))
    shutil.copytree(os.path.join(fontawesome_src, 'webfonts'), os.path.join(fontawesome_dst, 'webfonts'))
    
    print("Copying Fontsource (Outfit & Inter)...")
    fonts_dst = os.path.join(vendor_dir, 'fonts')
    if not os.path.exists(fonts_dst):
        os.makedirs(fonts_dst)
        
    copy_dir(os.path.join(node_modules, '@fontsource', 'outfit'), os.path.join(fonts_dst, 'outfit'))
    copy_dir(os.path.join(node_modules, '@fontsource', 'inter'), os.path.join(fonts_dst, 'inter'))

    print("Offline setup complete!")

if __name__ == '__main__':
    main()
