import cv2
import mediapipe as mp
import pandas as pd
import numpy as np
import os

mp_pose = mp.solutions.pose
pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)

# Fungsi Matematika untuk Menghitung Sudut antara 3 Titik (A, B, C)
def calculate_angle(a, b, c):
    a = np.array(a) # Titik A (Contoh: Bahu)
    b = np.array(b) # Titik B (Contoh: Siku - Titik Pusat)
    c = np.array(c) # Titik C (Contoh: Pergelangan tangan)
    
    radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
    angle = np.abs(radians*180.0/np.pi)
    
    if angle > 180.0:
        angle = 360 - angle
    return angle

# Fungsi Matematika untuk Menghitung Sudut terhadap Lantai (Ground)
def calculate_ground_angle(a, b):
    # Mengukur sudut kemiringan garis AB terhadap garis horizontal (lantai)
    delta_y = b[1] - a[1]
    delta_x = b[0] - a[0]
    angle = np.abs(np.arctan2(delta_y, delta_x) * 180.0 / np.pi)
    return angle

def ekstrak_video_ke_csv(video_path, label_olahraga, side='left'):
    cap = cv2.VideoCapture(video_path)
    data_list = []
    
    print(f"Mengekstrak video: {video_path} (Label: {label_olahraga})")
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        # Konversi warna ke RGB untuk MediaPipe
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(image)
        
        if results.pose_landmarks:
            landmarks = results.pose_landmarks.landmark
            
            # Ambil koordinat sisi kiri atau kanan
            if side == 'left':
                shoulder = [landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].x, landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].y]
                elbow = [landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].x, landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].y]
                wrist = [landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value].x, landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value].y]
                hip = [landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].x, landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].y]
                knee = [landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value].x, landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value].y]
                ankle = [landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value].x, landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value].y]
                foot = [landmarks[mp_pose.PoseLandmark.LEFT_FOOT_INDEX.value].x, landmarks[mp_pose.PoseLandmark.LEFT_FOOT_INDEX.value].y]
            else:
                shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
                elbow = [landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y]
                wrist = [landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].y]
                hip = [landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y]
                knee = [landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].y]
                ankle = [landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].y]
                foot = [landmarks[mp_pose.PoseLandmark.RIGHT_FOOT_INDEX.value].x, landmarks[mp_pose.PoseLandmark.RIGHT_FOOT_INDEX.value].y]

            # 1. Hitung Sudut Antar Sendi
            shoulder_angle = calculate_angle(hip, shoulder, elbow)
            elbow_angle = calculate_angle(shoulder, elbow, wrist)
            hip_angle = calculate_angle(shoulder, hip, knee)
            knee_angle = calculate_angle(hip, knee, ankle)
            ankle_angle = calculate_angle(knee, ankle, foot)
            
            # 2. Hitung Sudut Terhadap Lantai (Ground Angles)
            shoulder_ground_angle = calculate_ground_angle(hip, shoulder)
            elbow_ground_angle = calculate_ground_angle(shoulder, elbow)
            hip_ground_angle = calculate_ground_angle(knee, hip)
            knee_ground_angle = calculate_ground_angle(ankle, knee)
            ankle_ground_angle = calculate_ground_angle(foot, ankle)
            
            # Simpan baris data dengan urutan kolom yang PERSIS SAMA dengan file Kaggle
            data_list.append([
                side,
                shoulder_angle, elbow_angle, hip_angle, knee_angle, ankle_angle,
                shoulder_ground_angle, elbow_ground_angle, hip_ground_angle, knee_ground_angle, ankle_ground_angle,
                label_olahraga
            ])
            
    cap.release()
    return data_list

if __name__ == "__main__":
    print("Mulai mengekstrak video olahraga...")
    
    # 1. Siapkan list untuk menyimpan semua data
    semua_data = []
    
    # CONTOH PENGGUNAAN:
    # Ganti path ini dengan lokasi video MP4 Anda nanti
    # semua_data.extend(ekstrak_video_ke_csv("C:/Video/squat_depan.mp4", "Squats"))
    # semua_data.extend(ekstrak_video_ke_csv("C:/Video/pushup_samping.mp4", "Push Ups"))
    
    # 2. Buat DataFrame Pandas dengan Nama Kolom yang PERSIS SAMA dengan CSV kelompok Anda
    kolom = ['Side', 'Shoulder_Angle', 'Elbow_Angle', 'Hip_Angle', 'Knee_Angle', 'Ankle_Angle',
             'Shoulder_Ground_Angle', 'Elbow_Ground_Angle', 'Hip_Ground_Angle', 'Knee_Ground_Angle', 'Ankle_Ground_Angle', 'Label']
    
    df_baru = pd.DataFrame(semua_data, columns=kolom)
    
    # 3. Simpan ke CSV
    df_baru.to_csv("exercise_angles_baru.csv", index=False)
    print("Selesai! File 'exercise_angles_baru.csv' berhasil dibuat dan formatnya dijamin cocok 100%.")
