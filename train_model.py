import pandas as pd
import numpy as np
import os
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

def main():
    print("==================================================")
    # 1. Memuat Dataset
    print("[1/6] Membaca dataset 'exercise_angles.csv'...")
    dataset_path = 'exercise_angles.csv'
    
    if not os.path.exists(dataset_path):
        print(f"Error: File {dataset_path} tidak ditemukan!")
        return
        
    df = pd.read_csv(dataset_path)
    print(f"      Dataset berhasil dimuat! Ukuran data: {df.shape[0]} baris, {df.shape[1]} kolom.")

    # Filter: hanya gunakan 4 kategori (hapus Pull ups)
    EXCLUDED_LABELS = ['Pull ups']
    df = df[~df['Label'].isin(EXCLUDED_LABELS)]
    print(f"      Kategori '{', '.join(EXCLUDED_LABELS)}' dihapus dari dataset.")
    print(f"      Ukuran data setelah filter: {df.shape[0]} baris")

    # 2. Preprocessing Data
    print("\n[2/6] Memulai tahap Preprocessing...")
    
    # Hapus kolom 'Side' karena nilainya seragam ('left')
    if 'Side' in df.columns:
        df = df.drop(columns=['Side'])
        print("      Kolom 'Side' berhasil dihapus.")
        
    # Hapus kelas 'Jumping Jacks' dan 'Pull Ups' sesuai permintaan
    df = df[~df['Label'].isin(['Jumping Jacks', 'Pull Ups'])]
    print("      Filter: 'Jumping Jacks' dan 'Pull Ups' dihapus dari data latih.")
        
    # Memisahkan Fitur (X) dan Target (y)
    X = df.drop(columns=['Label'])
    y = df['Label']
    
    # Label Encoding untuk Target (mengubah teks kategori menjadi angka)
    label_encoder = LabelEncoder()
    y_encoded = label_encoder.fit_transform(y)
    print("      Kategori olahraga yang dideteksi:")
    for idx, class_name in enumerate(label_encoder.classes_):
        print(f"      - {class_name} -> {idx}")
        
    # Feature Scaling (Standardization)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    print("      Scaling fitur berhasil dilakukan dengan StandardScaler.")

    # 3. Split Data (80% Train, 20% Test)
    print("\n[3/6] Membagi data menjadi Train Set (80%) dan Test Set (20%)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y_encoded, 
        test_size=0.2, 
        random_state=42, 
        stratify=y_encoded
    )
    print(f"      Data Train: {X_train.shape[0]} baris")
    print(f"      Data Test:  {X_test.shape[0]} baris")

    # 4. Training Beberapa Model Klasifikasi
    print("\n[4/6] Melatih beberapa model Machine Learning...")
    
    models = {
        "Random Forest": RandomForestClassifier(n_estimators=100, random_state=42),
        "K-Nearest Neighbors (KNN)": KNeighborsClassifier(n_neighbors=5),
        "Decision Tree": DecisionTreeClassifier(random_state=42)
    }
    
    best_accuracy = 0
    best_model_name = ""
    best_model = None
    
    results = {}
    
    for name, model in models.items():
        print(f"      Melatih model {name}...")
        model.fit(X_train, y_train)
        
        # Prediksi data test
        y_pred = model.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        results[name] = acc
        print(f"      -> Akurasi {name}: {acc * 100:.2f}%")
        
        # Simpan model terbaik (tapi kita butuh Random Forest untuk JS export)
        if name == "Random Forest":
            best_model_name = name
            best_model = model

    print(f"\n      => Model yang diexport ke JS: {best_model_name}")

    # 5. Evaluasi Detail Model Terbaik
    print("\n[5/6] Evaluasi detail untuk Model Terbaik...")
    y_pred_best = best_model.predict(X_test)
    
    # Classification Report
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred_best, target_names=label_encoder.classes_))
    
    # Confusion Matrix
    print("Confusion Matrix:")
    cm = confusion_matrix(y_test, y_pred_best)
    print(cm)

    # 6. Menyimpan Model dan Preprocessing Artifacts
    print("\n[6/6] Menyimpan model dan preprocessing objek...")
    
    # Pastikan direktori model ada (kita simpan di root project saja agar mudah di-load)
    joblib.dump(best_model, 'best_model.pkl')
    joblib.dump(scaler, 'scaler.pkl')
    joblib.dump(label_encoder, 'label_encoder.pkl')
    
    print("      Model tersimpan sebagai: 'best_model.pkl'")
    print("      Scaler tersimpan sebagai: 'scaler.pkl'")
    print("      Label Encoder tersimpan sebagai: 'label_encoder.pkl'")
    print("==================================================")
    print("Pipeline Machine Learning Selesai dengan Sukses!")
    print("==================================================")

if __name__ == "__main__":
    main()
