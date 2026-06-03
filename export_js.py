import joblib
import m2cgen as m2c
import json

def export_model():
    print("Memuat model dan preprocessing objects...")
    model = joblib.load('best_model.pkl')
    scaler = joblib.load('scaler.pkl')
    label_encoder = joblib.load('label_encoder.pkl')

    print("Mengkonversi model ke JavaScript...")
    code = m2c.export_to_javascript(model)
    
    js_content = f"""// Auto-generated dari model AI
const SCALER_MEAN = {json.dumps(scaler.mean_.tolist())};
const SCALER_SCALE = {json.dumps(scaler.scale_.tolist())};
const LABEL_CLASSES = {json.dumps(label_encoder.classes_.tolist())};

{code}

// Ekspor untuk environment
if (typeof module !== 'undefined' && module.exports) {{
    module.exports = {{ score, SCALER_MEAN, SCALER_SCALE, LABEL_CLASSES }};
}}
"""

    with open('static/model_predict.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
    print("Model berhasil diekspor ke static/model_predict.js")

if __name__ == '__main__':
    export_model()
