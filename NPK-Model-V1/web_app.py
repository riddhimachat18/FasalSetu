"""
FLASK WEB SERVICE FOR NUTRIENT PREDICTION AGENT
Version with NO regex patterns - guaranteed to work
"""

from flask import Flask, request, jsonify, render_template_string
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from nutrient_agent_app import NutrientPredictionAgent

app = Flask(__name__)

# Initialize the agent
print("Initializing agent...")
agent = NutrientPredictionAgent()
print("✓ Agent ready")

# ============================================================================
# HTML TEMPLATE - NO REGEX VERSION
# ============================================================================

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Soil Nutrient Predictor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header p { opacity: 0.9; font-size: 14px; }
        
        .content { padding: 30px; }
        .form-group { margin-bottom: 20px; }
        
        label {
            display: block;
            font-weight: 600;
            margin-bottom: 8px;
            color: #333;
        }
        
        input, select {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        
        input:focus, select:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .input-hint {
            font-size: 12px;
            color: #666;
            margin-top: 4px;
        }
        
        button {
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        button:hover { transform: translateY(-2px); }
        button:active { transform: translateY(0); }
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .result-container {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 12px;
            display: none;
        }
        
        .result-container.show {
            display: block;
            animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .alert {
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 8px;
            border-left: 4px solid;
        }
        
        .alert-danger {
            background: #fee;
            border-color: #f44336;
            color: #c62828;
        }
        
        .alert-warning {
            background: #fffbee;
            border-color: #ffa726;
            color: #e65100;
        }
        
        .alert-info {
            background: #e3f2fd;
            border-color: #2196f3;
            color: #0d47a1;
        }
        
        .nutrient-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 15px;
            border-left: 4px solid #2ecc71;
        }
        
        .nutrient-card h3 {
            margin-bottom: 8px;
            color: #333;
        }
        
        .nutrient-value {
            font-size: 24px;
            font-weight: 700;
            color: #2ecc71;
            margin-bottom: 5px;
        }
        
        .recommendation {
            margin-top: 20px;
            padding: 20px;
            background: white;
            border-radius: 8px;
            line-height: 1.8;
        }
        
        .loading {
            text-align: center;
            padding: 20px;
            display: none;
        }
        
        .loading.show { display: block; }
        
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌱 Soil Nutrient Predictor</h1>
            <p>AI-Powered Smart Agriculture Decision Support</p>
        </div>
        
        <div class="content">
            <form id="prediction-form">
                <div class="form-group">
                    <label>Air Temperature (°C)</label>
                    <input type="number" id="temperature" step="0.1" value="28.0" required>
                    <div class="input-hint">Typical range: 20-40°C</div>
                </div>
                
                <div class="form-group">
                    <label>Humidity (%)</label>
                    <input type="number" id="humidity" step="0.1" value="65.0" required>
                    <div class="input-hint">Typical range: 40-90%</div>
                </div>
                
                <div class="form-group">
                    <label>Soil Moisture (%)</label>
                    <input type="number" id="moisture" step="0.1" value="45.0" required>
                    <div class="input-hint">Typical range: 20-70%</div>
                </div>
                
                <div class="form-group">
                    <label>Soil Type</label>
                    <select id="soil_type" required>
                        <option value="Sandy">Sandy</option>
                        <option value="Loamy" selected>Loamy</option>
                        <option value="Clayey">Clayey</option>
                        <option value="Black">Black (Vertisol)</option>
                        <option value="Red">Red (Laterite)</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Crop Type</label>
                    <select id="crop_type" required>
                        <option value="Maize" selected>Maize</option>
                        <option value="Wheat">Wheat</option>
                        <option value="Rice">Rice/Paddy</option>
                        <option value="Cotton">Cotton</option>
                        <option value="Sugarcane">Sugarcane</option>
                        <option value="Barley">Barley</option>
                        <option value="Millets">Millets</option>
                    </select>
                </div>
                
                <button type="submit" id="submit-btn">🔬 Analyze Soil Nutrients</button>
            </form>
            
            <div class="loading" id="loading">
                <div class="spinner"></div>
                <p style="margin-top: 10px;">Analyzing soil conditions...</p>
            </div>
            
            <div class="result-container" id="results"></div>
        </div>
    </div>
    
    <script>
        // Helper function to format text - NO REGEX!
        function formatText(text) {
            // Simple string replacement without regex
            let formatted = text;
            
            // Replace **text** with <strong>text</strong>
            while (formatted.indexOf('**') !== -1) {
                let firstPos = formatted.indexOf('**');
                let secondPos = formatted.indexOf('**', firstPos + 2);
                
                if (secondPos === -1) break;
                
                let before = formatted.substring(0, firstPos);
                let content = formatted.substring(firstPos + 2, secondPos);
                let after = formatted.substring(secondPos + 2);
                
                formatted = before + '<strong>' + content + '</strong>' + after;
            }
            
            // Replace newlines with <br>
            formatted = formatted.split('\\n').join('<br>');
            
            return formatted;
        }
        
        document.getElementById('prediction-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Show loading
            document.getElementById('loading').classList.add('show');
            document.getElementById('results').classList.remove('show');
            document.getElementById('submit-btn').disabled = true;
            
            // Gather form data
            const data = {
                temperature: parseFloat(document.getElementById('temperature').value),
                humidity: parseFloat(document.getElementById('humidity').value),
                moisture: parseFloat(document.getElementById('moisture').value),
                soil_type: document.getElementById('soil_type').value,
                crop_type: document.getElementById('crop_type').value
            };
            
            console.log('Sending request:', data);
            
            try {
                // Call API
                const response = await fetch('/api/predict', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                console.log('Response status:', response.status);
                
                if (!response.ok) {
                    throw new Error('Server returned error: ' + response.status);
                }
                
                const result = await response.json();
                console.log('Result:', result);
                
                // Hide loading
                document.getElementById('loading').classList.remove('show');
                document.getElementById('submit-btn').disabled = false;
                
                // Display results
                displayResults(result);
                
            } catch (error) {
                console.error('Error:', error);
                document.getElementById('loading').classList.remove('show');
                document.getElementById('submit-btn').disabled = false;
                
                const container = document.getElementById('results');
                container.innerHTML = '<div class="alert alert-danger"><strong>Error:</strong> ' + error.message + '<br><br>Check the browser console (F12) for more details.</div>';
                container.classList.add('show');
            }
        });
        
        function displayResults(result) {
            const container = document.getElementById('results');
            
            if (!result.success) {
                container.innerHTML = '<div class="alert alert-danger"><strong>Error:</strong> ' + (result.error || 'Unknown error') + '</div>';
                container.classList.add('show');
                return;
            }
            
            let html = '';
            
            // Show alerts if any
            if (result.alerts && result.alerts.length > 0) {
                result.alerts.forEach(alert => {
                    const alertClass = alert.level === 'HIGH_RISK' ? 'alert-danger' : 
                                     alert.level === 'MODERATE_RISK' ? 'alert-warning' : 'alert-info';
                    html += '<div class="alert ' + alertClass + '">';
                    html += '<strong>' + alert.level + ':</strong> ' + alert.message + '<br>';
                    html += '<strong>Action:</strong> ' + alert.action;
                    html += '</div>';
                });
            }
            
            // Show nutrient predictions
            const nutrients = ['nitrogen', 'phosphorous', 'potassium'];
            nutrients.forEach(nutrient => {
                const pred = result.predictions[nutrient];
                if (pred && pred.value !== null) {
                    html += '<div class="nutrient-card">';
                    html += '<h3>' + nutrient.charAt(0).toUpperCase() + nutrient.slice(1) + ' (N/P/K)</h3>';
                    html += '<div class="nutrient-value">' + pred.value + ' kg/ha</div>';
                    html += '<div style="color: #666; font-size: 14px;">';
                    html += 'Range: ' + pred.lower_bound + ' - ' + pred.upper_bound + ' kg/ha<br>';
                    html += 'Confidence: ' + pred.confidence;
                    html += '</div></div>';
                }
            });
            
            // Show recommendation - using our formatText function (no regex!)
            if (result.recommendation) {
                html += '<div class="recommendation">';
                html += formatText(result.recommendation);
                html += '</div>';
            }
            
            container.innerHTML = html;
            container.classList.add('show');
            
            // Scroll to results
            container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    </script>
</body>
</html>
"""

# ============================================================================
# ROUTES
# ============================================================================

@app.route('/')
def home():
    """Serve the main web interface"""
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/predict', methods=['POST'])
def predict():
    """API endpoint for nutrient prediction"""
    try:
        data = request.get_json()
        
        print(f"\n{'='*80}")
        print("NEW PREDICTION REQUEST")
        print(f"{'='*80}")
        print(f"Data received: {data}")
        
        # Validate inputs
        required_fields = ['temperature', 'humidity', 'moisture', 'soil_type', 'crop_type']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        # Prepare sensor data
        sensor_data = {
            'temperature': float(data['temperature']),
            'humidity': float(data['humidity']),
            'moisture': float(data['moisture'])
        }
        
        print(f"Sensor data: {sensor_data}")
        print(f"Soil type: {data['soil_type']}")
        print(f"Crop type: {data['crop_type']}")
        
        # Run prediction
        print("Running prediction...")
        result = agent.predict(
            sensor_data=sensor_data,
            soil_type=data['soil_type'],
            crop_type=data['crop_type']
        )
        
        print("Prediction complete!")
        print(f"Success: {result.get('success')}")
        if result.get('predictions'):
            print(f"N: {result['predictions']['nitrogen']['value']}")
            print(f"P: {result['predictions']['phosphorous']['value']}")
            print(f"K: {result['predictions']['potassium']['value']}")
        
        return jsonify(result)
        
    except Exception as e:
        print(f"\n{'='*80}")
        print("ERROR IN PREDICTION")
        print(f"{'='*80}")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'error': f'{type(e).__name__}: {str(e)}'
        }), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'Nutrient Prediction Agent',
        'version': '1.0.0'
    })

# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    print("="*80)
    print("STARTING NUTRIENT PREDICTION WEB SERVICE")
    print("="*80)
    print("\nService will run at: http://localhost:5000")
    print("API endpoint: http://localhost:5000/api/predict")
    print("\nPress Ctrl+C to stop the server")
    print("\n" + "="*80 + "\n")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
