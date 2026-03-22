"""
FEATURE ENGINEERING IMPLEMENTATION FOR data_core_csv.xlsx
Adapted for static snapshot data (no temporal dynamics)

Author: Riddhima's AgTech Soft-Sensing System
Purpose: Extract maximum agronomic signal from limited static measurements
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
import warnings
warnings.filterwarnings('ignore')

# ============================================================================
# STEP 1: LOAD AND PREPARE DATA
# ============================================================================

def load_and_prepare_data(filepath):
    """Load the dataset and perform initial cleaning"""
    df = pd.read_excel(filepath)
    
    # Standardize column names
    df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
    
    # Fix typo in temperature
    if 'temparature' in df.columns:
        df.rename(columns={'temparature': 'temperature'}, inplace=True)
    
    print(f"Loaded dataset: {df.shape[0]} rows, {df.shape[1]} columns")
    print(f"Columns: {df.columns.tolist()}")
    
    return df


# ============================================================================
# STEP 2: SOIL TEXTURE MAPPING AND PEDOTRANSFER FUNCTIONS
# ============================================================================

def get_soil_properties(soil_type):
    """
    Map soil types to physical properties using simplified pedotransfer functions
    Based on USDA soil texture classification
    
    Returns: dict with field_capacity, wilting_point, clay_fraction, CEC_baseline
    """
    soil_properties = {
        'sandy': {
            'field_capacity': 0.10,      # volumetric water content at field capacity
            'wilting_point': 0.04,
            'clay_fraction': 0.05,       # 5% clay
            'cec_baseline': 5,           # cmol/kg - low cation exchange capacity
            'om_baseline': 0.5           # % organic matter (typical)
        },
        'loamy': {
            'field_capacity': 0.25,
            'wilting_point': 0.12,
            'clay_fraction': 0.20,
            'cec_baseline': 15,
            'om_baseline': 2.0
        },
        'clayey': {
            'field_capacity': 0.40,
            'wilting_point': 0.25,
            'clay_fraction': 0.50,
            'cec_baseline': 30,
            'om_baseline': 2.5
        },
        'black': {  # Black cotton soil (Indian Vertisols)
            'field_capacity': 0.45,
            'wilting_point': 0.28,
            'clay_fraction': 0.55,
            'cec_baseline': 35,
            'om_baseline': 1.5
        },
        'red': {  # Red lateritic soil (Indian Alfisols/Ultisols)
            'field_capacity': 0.22,
            'wilting_point': 0.10,
            'clay_fraction': 0.30,
            'cec_baseline': 12,
            'om_baseline': 1.0
        }
    }
    
    return soil_properties.get(soil_type.lower(), soil_properties['loamy'])


def add_soil_properties(df):
    """Add soil physical properties based on soil type"""
    
    # Initialize new columns
    df['field_capacity'] = 0.0
    df['wilting_point'] = 0.0
    df['clay_fraction'] = 0.0
    df['cec_baseline'] = 0.0
    df['om_baseline'] = 0.0
    
    # Map properties for each row
    for idx, row in df.iterrows():
        props = get_soil_properties(row['soil_type'])
        df.at[idx, 'field_capacity'] = props['field_capacity']
        df.at[idx, 'wilting_point'] = props['wilting_point']
        df.at[idx, 'clay_fraction'] = props['clay_fraction']
        df.at[idx, 'cec_baseline'] = props['cec_baseline']
        df.at[idx, 'om_baseline'] = props['om_baseline']
    
    return df


# ============================================================================
# STEP 3: INSTANTANEOUS FEATURE ENGINEERING (Adapted for Static Data)
# ============================================================================

def calculate_vpd(temperature, humidity):
    """
    Calculate Vapor Pressure Deficit (VPD) in kPa
    
    VPD = e_s - e_a
    where e_s = saturation vapor pressure, e_a = actual vapor pressure
    """
    # Saturation vapor pressure (kPa) - Tetens formula
    e_s = 0.6108 * np.exp((17.27 * temperature) / (temperature + 237.3))
    
    # Actual vapor pressure
    e_a = (humidity / 100) * e_s
    
    # VPD
    vpd = e_s - e_a
    
    return vpd


def calculate_soil_moisture_deficit(moisture_pct, field_capacity):
    """
    Calculate soil moisture deficit (SMD)
    
    SMD = θ_fc - θ_current
    Positive SMD = deficit (dry soil)
    Negative SMD = excess (saturated soil)
    """
    # Convert moisture percentage to volumetric water content (approximation)
    theta_current = moisture_pct / 100.0
    
    smd = field_capacity - theta_current
    
    return smd


def calculate_saturation_excess(moisture_pct, field_capacity):
    """
    Calculate saturation excess
    Positive values indicate soil is above field capacity (leaching risk)
    """
    theta_current = moisture_pct / 100.0
    saturation_excess = max(0, theta_current - field_capacity)
    
    return saturation_excess


def calculate_q10_proxy(moisture_pct, soil_temp_estimate):
    """
    Q10 proxy for microbial nitrogen mineralization rate
    
    Q10_proxy = θ_soil × exp(0.115 × (T_soil - T_ref))
    
    NOTE: We're using air temperature as soil temp estimate (limitation)
    """
    theta_soil = moisture_pct / 100.0
    T_ref = 25.0  # Reference temperature in Celsius
    
    # Arrhenius-based temperature factor
    q10_proxy = theta_soil * np.exp(0.115 * (soil_temp_estimate - T_ref))
    
    return q10_proxy


def calculate_et0_hargreaves(t_min, t_max, latitude=20.0, day_of_year=180):
    """
    Estimate reference evapotranspiration (ET0) using Hargreaves-Samani equation
    
    ET0 = 0.0023 × (T_mean + 17.8) × (T_max - T_min)^0.5 × Ra
    
    NOTE: Since we only have air temperature (single value), we estimate T_min and T_max
    """
    # Estimate daily range (simplified - ideally you'd have actual min/max)
    t_mean = (t_min + t_max) / 2
    
    # Calculate extraterrestrial radiation (Ra) - simplified
    # This is a rough approximation; proper calculation requires lat/lon and date
    # For mid-latitudes during growing season, Ra ≈ 35-40 MJ/m²/day
    Ra = 38.0  # MJ/m²/day (approximate average)
    
    # Hargreaves formula
    et0 = 0.0023 * (t_mean + 17.8) * np.sqrt(t_max - t_min) * Ra
    
    return et0


def calculate_n_mineralization_index(q10_proxy, om_baseline):
    """
    Nitrogen mineralization potential index
    
    N_min_index = Q10_proxy × OM_baseline
    
    NOTE: Without WDCC (wetting-drying cycles), this is simplified
    """
    n_min_index = q10_proxy * om_baseline
    
    return n_min_index


def calculate_k_depletion_proxy(et0_estimate, vpd, cec_baseline):
    """
    Potassium depletion proxy
    
    K_depletion = ET0 × VPD × (1 / CEC)
    
    High ET and VPD with low CEC = high K depletion risk
    """
    k_depletion = et0_estimate * vpd * (1.0 / max(cec_baseline, 1))
    
    return k_depletion


def calculate_n_leach_risk(saturation_excess, clay_fraction):
    """
    Nitrogen leaching risk score (static version)
    
    N_leach_risk = Saturation_Excess × (1 - clay_fraction)
    
    NOTE: Without CLI_7d (cumulative leaching index), this is instantaneous only
    """
    n_leach_risk = saturation_excess * (1 - clay_fraction)
    
    return n_leach_risk


def engineer_features(df):
    """
    Main feature engineering pipeline
    Extract all possible agronomic features from static measurements
    """
    print("\n" + "="*80)
    print("FEATURE ENGINEERING PIPELINE")
    print("="*80)
    
    # 1. Add soil properties from soil type
    print("\n[1/6] Adding soil physical properties...")
    df = add_soil_properties(df)
    
    # 2. Calculate VPD
    print("[2/6] Calculating Vapor Pressure Deficit (VPD)...")
    df['vpd_kpa'] = df.apply(
        lambda row: calculate_vpd(row['temperature'], row['humidity']), 
        axis=1
    )
    
    # 3. Calculate soil moisture deficit
    print("[3/6] Calculating Soil Moisture Deficit (SMD)...")
    df['smd'] = df.apply(
        lambda row: calculate_soil_moisture_deficit(row['moisture'], row['field_capacity']),
        axis=1
    )
    
    # 4. Calculate saturation excess (leaching indicator)
    print("[4/6] Calculating Saturation Excess...")
    df['saturation_excess'] = df.apply(
        lambda row: calculate_saturation_excess(row['moisture'], row['field_capacity']),
        axis=1
    )
    
    # 5. Calculate Q10 proxy (using air temp as soil temp estimate)
    print("[5/6] Calculating Q10 Proxy (N mineralization indicator)...")
    # Estimate soil temp as ~0.9 × air temp (rough approximation)
    df['soil_temp_estimate'] = df['temperature'] * 0.9
    df['q10_proxy'] = df.apply(
        lambda row: calculate_q10_proxy(row['moisture'], row['soil_temp_estimate']),
        axis=1
    )
    
    # 6. Calculate composite nutrient stress features
    print("[6/6] Calculating composite nutrient stress features...")
    
    # Estimate T_min and T_max (rough approximation from single temperature reading)
    # Assume daily range of ~10°C
    df['t_max_est'] = df['temperature'] + 5
    df['t_min_est'] = df['temperature'] - 5
    
    # ET0 estimate
    df['et0_estimate'] = df.apply(
        lambda row: calculate_et0_hargreaves(row['t_min_est'], row['t_max_est']),
        axis=1
    )
    
    # N mineralization index
    df['n_mineralization_index'] = df.apply(
        lambda row: calculate_n_mineralization_index(row['q10_proxy'], row['om_baseline']),
        axis=1
    )
    
    # K depletion proxy
    df['k_depletion_proxy'] = df.apply(
        lambda row: calculate_k_depletion_proxy(row['et0_estimate'], row['vpd_kpa'], row['cec_baseline']),
        axis=1
    )
    
    # N leaching risk
    df['n_leach_risk'] = df.apply(
        lambda row: calculate_n_leach_risk(row['saturation_excess'], row['clay_fraction']),
        axis=1
    )
    
    # General stress compound (simplified without GDD deviation)
    df['general_stress'] = df['smd'] * df['vpd_kpa']
    
    # P immobility index (temperature-based)
    df['p_immobility_index'] = df['soil_temp_estimate'].apply(
        lambda t: 1.0 / max(t, 10) if t < 15 else 0.1
    )
    
    print("\n✓ Feature engineering complete!")
    print(f"  Total features created: {df.shape[1] - 9} new columns")
    
    return df


# ============================================================================
# STEP 4: PREPARE TRAINING DATA
# ============================================================================

def prepare_training_data(df, target_nutrient='nitrogen'):
    """
    Prepare features and labels for model training
    
    Args:
        df: DataFrame with engineered features
        target_nutrient: 'nitrogen', 'phosphorous', or 'potassium'
    
    Returns:
        X_train, X_test, y_train, y_test, feature_names, scaler
    """
    print(f"\n" + "="*80)
    print(f"PREPARING TRAINING DATA FOR {target_nutrient.upper()} PREDICTION")
    print("="*80)
    
    # Select features (exclude targets and categorical variables)
    feature_cols = [
        'temperature', 'humidity', 'moisture',
        'field_capacity', 'wilting_point', 'clay_fraction', 'cec_baseline', 'om_baseline',
        'vpd_kpa', 'smd', 'saturation_excess', 'soil_temp_estimate', 'q10_proxy',
        'et0_estimate', 'n_mineralization_index', 'k_depletion_proxy', 
        'n_leach_risk', 'general_stress', 'p_immobility_index'
    ]
    
    # Encode soil type and crop type as additional features
    le_soil = LabelEncoder()
    le_crop = LabelEncoder()
    
    df['soil_type_encoded'] = le_soil.fit_transform(df['soil_type'])
    df['crop_type_encoded'] = le_crop.fit_transform(df['crop_type'])
    
    feature_cols.extend(['soil_type_encoded', 'crop_type_encoded'])
    
    # Prepare X and y
    X = df[feature_cols].copy()
    y = df[target_nutrient].copy()
    
    # Handle any missing values
    X = X.fillna(X.median())
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    print(f"\n✓ Training data prepared:")
    print(f"  Training samples: {X_train.shape[0]}")
    print(f"  Test samples: {X_test.shape[0]}")
    print(f"  Features: {X_train.shape[1]}")
    print(f"  Target range: {y.min():.1f} - {y.max():.1f}")
    
    return X_train_scaled, X_test_scaled, y_train, y_test, feature_cols, scaler


# ============================================================================
# STEP 5: MAIN EXECUTION
# ============================================================================

if __name__ == "__main__":
    
    # Load data
    df = load_and_prepare_data(r"C:\Users\riddh\Desktop\4th_Semester\files\data_core_csv.xlsx")
    
    # Engineer features
    df_featured = engineer_features(df)
    
    # Display sample of engineered features
    print("\n" + "="*80)
    print("SAMPLE OF ENGINEERED FEATURES")
    print("="*80)
    
    display_cols = [
        'temperature', 'humidity', 'moisture', 'soil_type',
        'nitrogen', 'phosphorous', 'potassium',
        'vpd_kpa', 'smd', 'q10_proxy', 'n_mineralization_index', 'n_leach_risk'
    ]
    
    print(df_featured[display_cols].head(10).to_string())
    
    # Save engineered dataset
    output_path = r'C:\Users\riddh\Desktop\4th_Semester\files\data_engineered_features.csv'
    df_featured.to_csv(output_path, index=False)
    print(f"\n✓ Engineered dataset saved to: {output_path}")
    
    # Prepare training data for each nutrient
    print("\n" + "="*80)
    print("PREPARING TRAINING DATASETS")
    print("="*80)
    
    for nutrient in ['nitrogen', 'phosphorous', 'potassium']:
        X_train, X_test, y_train, y_test, features, scaler = prepare_training_data(
            df_featured, target_nutrient=nutrient
        )
        
        # Save prepared data
        np.savez(
            fr'C:\Users\riddh\Desktop\4th_Semester\files\{nutrient}_training_data.npz',
            X_train=X_train,
            X_test=X_test,
            y_train=y_train,
            y_test=y_test,
            feature_names=features
        )
        print(f"✓ Saved: {nutrient}_training_data.npz\n")
    
    print("\n" + "="*80)
    print("FEATURE ENGINEERING COMPLETE")
    print("="*80)
    print("\nNext steps:")
    print("1. Train models using the prepared .npz files")
    print("2. Evaluate model performance")
    print("3. Deploy best model for field validation")
    print("\nNote: This is a STATIC SNAPSHOT model.")
    print("For temporal dynamics (CLI, WDCC, GDD), you need time-series data.")
