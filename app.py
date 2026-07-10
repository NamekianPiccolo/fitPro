import os
import joblib
import pandas as pd
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

# Load models and preprocessing artifacts
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(BASE_DIR, 'ml', 'models', 'best_model.pkl')
scaler_path = os.path.join(BASE_DIR, 'ml', 'models', 'scaler.pkl')
label_encoder_path = os.path.join(BASE_DIR, 'ml', 'models', 'label_encoder.pkl')

if not os.path.exists(model_path) or not os.path.exists(scaler_path) or not os.path.exists(label_encoder_path):
    raise FileNotFoundError(f"Model artifacts not found! Please run python ml/train_model.py first. (Paths checked: {model_path}, {scaler_path}, {label_encoder_path})")

model = joblib.load(model_path)
scaler = joblib.load(scaler_path)
label_encoder = joblib.load(label_encoder_path)

# Feature names in the exact order they were trained
FEATURE_NAMES = [
    'Shoulder_Angle',
    'Elbow_Angle',
    'Hip_Angle',
    'Knee_Angle',
    'Ankle_Angle',
    'Shoulder_Ground_Angle',
    'Elbow_Ground_Angle',
    'Hip_Ground_Angle',
    'Knee_Ground_Angle',
    'Ankle_Ground_Angle'
]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        if not data or 'features' not in data:
            return jsonify({'error': 'Invalid input. JSON with "features" key is required.'}), 400
        
        features_list = data['features']
        if len(features_list) != 10:
            return jsonify({'error': f'Expected 10 features, but got {len(features_list)}.'}), 400
            
        # Create DataFrame to match training columns and avoid sklearn warnings
        df_features = pd.DataFrame([features_list], columns=FEATURE_NAMES)
        
        # Scale features
        scaled_features = scaler.transform(df_features)
        
        # Predict class index
        pred_class_idx = model.predict(scaled_features)[0]
        
        # Get class probabilities
        probabilities = model.predict_proba(scaled_features)[0]
        confidence = float(probabilities[pred_class_idx])
        
        # Decode class label
        pred_label = label_encoder.inverse_transform([pred_class_idx])[0]
        
        return jsonify({
            'prediction': pred_label,
            'confidence': confidence
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

import urllib.request
import urllib.parse
import io
from flask import send_file

@app.route('/tts')
def tts_proxy():
    text = request.args.get('text', '')
    lang = request.args.get('lang', 'id')
    if not text:
        return "No text", 400
    
    url = f"https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl={lang}&q={urllib.parse.quote(text)}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            audio_data = response.read()
        return send_file(
            io.BytesIO(audio_data),
            mimetype="audio/mpeg"
        )
    except Exception as e:
        return str(e), 500


if __name__ == '__main__':
    print("Starting Flask server on http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=True)
