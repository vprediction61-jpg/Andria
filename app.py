from flask import Flask, request, jsonify
import os, joblib, json, traceback

app = Flask(__name__)
MODEL_PATH = os.environ.get('MODEL_DIR','/models/model.pkl')

def load_model():
    if os.path.exists(MODEL_PATH):
        try:
            return joblib.load(MODEL_PATH)
        except Exception as e:
            print('model load err', e)
    return None

model = load_model()

@app.route('/health')
def health():
    return jsonify({'status':'ok','model_loaded': model is not None})

def featurize(payload):
    # Very small example featurizer - replace with domain features
    mode = payload.get('mode','time')
    inp = str(payload.get('input',''))
    s = sum([ord(c) for c in inp])
    return {'hash': s % 1000, 'len': len(inp), 'mode': 1 if mode=='time' else 0}

@app.route('/predict', methods=['POST'])
def predict():
    try:
        payload = request.json or {}
        feats = featurize(payload)
        # if model exists, use it; else return a deterministic result derived from features
        if model is not None:
            X = [feats['hash'], feats['len'], feats['mode']]
            # model should accept the features as array-like; adapt as needed
            proba = model.predict_proba([X])[0]
            classes = model.classes_.tolist() if hasattr(model, 'classes_') else [0,1]
            best = int(proba.argmax())
            return jsonify({'pick': str(classes[best]), 'confidence': float(proba[best]), 'proba': proba.tolist(), 'feats': feats})
        else:
            # deterministic fallback
            h = feats['hash']
            multiplier = round(1 + (h % 100)/100, 2)
            confidence = float(0.4 + ((h % 60)/100))
            return jsonify({'fallback': True, 'multiplier': multiplier, 'confidence': confidence, 'feats': feats})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error':'predict error','detail': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
