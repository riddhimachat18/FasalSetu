"""
MODEL TRAINING SCRIPT FOR NUTRIENT PREDICTION
Using XGBoost and Random Forest on engineered features

This trains the ML layer (Layer 2) of your 3-layer agent system
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split

# Try to import XGBoost (install if needed)
try:
    import xgboost as xgb
    from xgboost.callback import EarlyStopping
    XGBOOST_AVAILABLE = True
except ImportError:
    print("WARNING: XGBoost not installed. Using Random Forest only.")
    print("Install with: pip install xgboost")
    XGBOOST_AVAILABLE = False

# Set random seed for reproducibility
np.random.seed(42)


def load_training_data(nutrient='nitrogen'):
    """Load prepared training data"""
    data = np.load(fr'C:\Users\riddh\Desktop\4th_Semester\files\{nutrient}_training_data.npz', allow_pickle=True)
    
    return {
        'X_train': data['X_train'],
        'X_test': data['X_test'],
        'y_train': data['y_train'],
        'y_test': data['y_test'],
        'features': data['feature_names']
    }


def train_random_forest(X_train, y_train, X_test, y_test):
    """Train Random Forest model"""
    print("\n  Training Random Forest...")
    
    rf_model = RandomForestRegressor(
        n_estimators=200,
        max_depth=12,
        min_samples_split=10,
        min_samples_leaf=4,
        max_features='sqrt',
        random_state=42,
        n_jobs=-1
    )
    
    rf_model.fit(X_train, y_train)
    
    # Predictions
    y_pred_train = rf_model.predict(X_train)
    y_pred_test = rf_model.predict(X_test)
    
    # Metrics
    metrics = {
        'train_mae': mean_absolute_error(y_train, y_pred_train),
        'test_mae': mean_absolute_error(y_test, y_pred_test),
        'train_rmse': np.sqrt(mean_squared_error(y_train, y_pred_train)),
        'test_rmse': np.sqrt(mean_squared_error(y_test, y_pred_test)),
        'train_r2': r2_score(y_train, y_pred_train),
        'test_r2': r2_score(y_test, y_pred_test)
    }
    
    return rf_model, metrics, y_pred_test


def train_xgboost(X_train, y_train, X_test, y_test):
    """Train XGBoost model with proper validation set"""
    print("\n  Training XGBoost...")
    
    # Split training data into train + validation (80/20 of the training set)
    X_train_final, X_val, y_train_final, y_val = train_test_split(
        X_train, y_train, test_size=0.2, random_state=42
    )
    
    xgb_model = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        n_jobs=-1,
        early_stopping_rounds=50  # Built-in early stopping
    )
    
    xgb_model.fit(
        X_train_final,
        y_train_final,
        eval_set=[(X_val, y_val)],
        verbose=False
    )
    
    # Predictions on original test set
    y_pred_train = xgb_model.predict(X_train)  # Use full X_train for consistency
    y_pred_test = xgb_model.predict(X_test)
    
    # Metrics
    metrics = {
        'train_mae': mean_absolute_error(y_train, y_pred_train),
        'test_mae': mean_absolute_error(y_test, y_pred_test),
        'train_rmse': np.sqrt(mean_squared_error(y_train, y_pred_train)),
        'test_rmse': np.sqrt(mean_squared_error(y_test, y_pred_test)),
        'train_r2': r2_score(y_train, y_pred_train),
        'test_r2': r2_score(y_test, y_pred_test)
    }
    
    return xgb_model, metrics, y_pred_test


def print_metrics(nutrient, model_name, metrics):
    """Print model performance metrics"""
    print(f"\n  {model_name} Performance:")
    print(f"    Train MAE: {metrics['train_mae']:.2f} | Test MAE: {metrics['test_mae']:.2f}")
    print(f"    Train RMSE: {metrics['train_rmse']:.2f} | Test RMSE: {metrics['test_rmse']:.2f}")
    print(f"    Train R²: {metrics['train_r2']:.3f} | Test R²: {metrics['test_r2']:.3f}")


def get_feature_importance(model, feature_names, model_type='rf'):
    """Extract feature importance"""
    if model_type == 'rf':
        importance = model.feature_importances_
    elif model_type == 'xgb':
        importance = model.feature_importances_
    
    # Create DataFrame
    importance_df = pd.DataFrame({
        'feature': feature_names,
        'importance': importance
    }).sort_values('importance', ascending=False)
    
    return importance_df


def create_performance_report(nutrient, models_dict, data):
    """Create a comprehensive performance report"""
    
    report = []
    report.append("="*80)
    report.append(f"{nutrient.upper()} PREDICTION - MODEL PERFORMANCE REPORT")
    report.append("="*80)
    
    report.append(f"\nDataset Statistics:")
    report.append(f"  Training samples: {len(data['y_train'])}")
    report.append(f"  Test samples: {len(data['y_test'])}")
    report.append(f"  Features used: {len(data['features'])}")
    report.append(f"  Target range: {data['y_test'].min():.1f} - {data['y_test'].max():.1f}")
    
    # Compare models
    report.append(f"\nModel Comparison:")
    report.append(f"{'Model':<20} {'Test MAE':<12} {'Test RMSE':<12} {'Test R²':<10}")
    report.append("-"*60)
    
    for model_name, model_info in models_dict.items():
        metrics = model_info['metrics']
        report.append(
            f"{model_name:<20} "
            f"{metrics['test_mae']:<12.2f} "
            f"{metrics['test_rmse']:<12.2f} "
            f"{metrics['test_r2']:<10.3f}"
        )
    
    # Best model
    best_model = min(models_dict.items(), key=lambda x: x[1]['metrics']['test_mae'])
    report.append(f"\n✓ Best Model: {best_model[0]} (lowest Test MAE)")
    
    # Feature importance (top 10)
    report.append(f"\nTop 10 Most Important Features ({best_model[0]}):")
    importance_df = get_feature_importance(
        best_model[1]['model'], 
        data['features'],
        model_type='xgb' if 'XGBoost' in best_model[0] else 'rf'
    )
    
    for idx, row in importance_df.head(10).iterrows():
        report.append(f"  {row['feature']:<30} {row['importance']:.4f}")
    
    return "\n".join(report)


# ============================================================================
# MAIN TRAINING LOOP
# ============================================================================

if __name__ == "__main__":
    
    print("="*80)
    print("NUTRIENT PREDICTION MODEL TRAINING")
    print("="*80)
    
    all_results = {}
    
    for nutrient in ['nitrogen', 'phosphorous', 'potassium']:
        
        print(f"\n{'='*80}")
        print(f"TRAINING MODELS FOR {nutrient.upper()}")
        print(f"{'='*80}")
        
        # Load data
        data = load_training_data(nutrient)
        
        models = {}
        
        # Train Random Forest
        rf_model, rf_metrics, rf_preds = train_random_forest(
            data['X_train'], data['y_train'],
            data['X_test'], data['y_test']
        )
        models['Random Forest'] = {
            'model': rf_model,
            'metrics': rf_metrics,
            'predictions': rf_preds
        }
        print_metrics(nutrient, 'Random Forest', rf_metrics)
        
        # Train XGBoost (if available)
        if XGBOOST_AVAILABLE:
            xgb_model, xgb_metrics, xgb_preds = train_xgboost(
                data['X_train'], data['y_train'],
                data['X_test'], data['y_test']
            )
            models['XGBoost'] = {
                'model': xgb_model,
                'metrics': xgb_metrics,
                'predictions': xgb_preds
            }
            print_metrics(nutrient, 'XGBoost', xgb_metrics)
        
        # Generate report
        report = create_performance_report(nutrient, models, data)
        print(f"\n{report}")
        
        # Save report
        with open(fr'C:\Users\riddh\Desktop\4th_Semester\files\{nutrient}_model_report.txt', 'w', encoding="utf-8") as f:
            f.write(report)
        
        # Save best model (using Random Forest as default, or XGBoost if better)
        if XGBOOST_AVAILABLE and xgb_metrics['test_mae'] < rf_metrics['test_mae']:
            best_model = xgb_model
            best_model_name = 'XGBoost'
        else:
            best_model = rf_model
            best_model_name = 'Random Forest'
        
        # Store results
        all_results[nutrient] = {
            'best_model': best_model,
            'best_model_name': best_model_name,
            'models': models,
            'data': data
        }
        
        print(f"\n✓ Best model for {nutrient}: {best_model_name}")
        print(f"  Saved report: {nutrient}_model_report.txt")
    
    # Create summary comparison
    print("\n" + "="*80)
    print("OVERALL SUMMARY - ALL NUTRIENTS")
    print("="*80)
    
    summary = []
    summary.append(f"\n{'Nutrient':<15} {'Best Model':<20} {'Test MAE':<12} {'Test R²':<10}")
    summary.append("-"*60)
    
    for nutrient, results in all_results.items():
        best_metrics = results['models'][results['best_model_name']]['metrics']
        summary.append(
            f"{nutrient.capitalize():<15} "
            f"{results['best_model_name']:<20} "
            f"{best_metrics['test_mae']:<12.2f} "
            f"{best_metrics['test_r2']:<10.3f}"
        )
    
    summary_text = "\n".join(summary)
    print(summary_text)
    
    # Save overall summary
    with open(r'C:\Users\riddh\Desktop\4th_Semester\files\overall_model_summary.txt', 'w') as f:
        f.write("="*80 + "\n")
        f.write("OVERALL MODEL TRAINING SUMMARY\n")
        f.write("="*80 + "\n")
        f.write(summary_text)
        f.write("\n\n")
        f.write("Dataset: data_core_csv.xlsx\n")
        f.write("Total samples: 8,000\n")
        f.write("Train/Test split: 80/20\n")
        f.write("Feature engineering: Physics-informed agronomic features\n")
        f.write("\nNote: These are STATIC SNAPSHOT models.\n")
        f.write("For temporal dynamics prediction, time-series sensor data is required.\n")
    
    print(f"\n✓ Overall summary saved: overall_model_summary.txt")
    print("\n" + "="*80)
    print("MODEL TRAINING COMPLETE")
    print("="*80)
    print("\nNext steps:")
    print("1. Review model reports for each nutrient")
    print("2. Implement the models in your agent's Layer 2 (ML Inference Engine)")
    print("3. Build the rule-based Layer 1 and LLM Layer 3")
    print("4. Deploy for field validation with real sensor data")
