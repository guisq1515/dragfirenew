import { PowerReference, RunResult } from '../types';

/**
 * Service to estimate vehicle horsepower (CV) based on performance data.
 * Accounts for vehicle weight and road incline (slope).
 */
export const powerService = {
  /**
   * Estimates engine horsepower (CV)
   * Formula: P_total = P_kinetic + P_potential (gravity) + P_drag + P_drivetrain_loss
   */
  estimateHorsepower(
    result: RunResult,
    weightKg: number,
    references: PowerReference[]
  ): number {
    if (!weightKg || result.time <= 0) return 0;

    // 1. Kinetic Energy Power (0 to Final Speed)
    // Final speed in m/s
    const v_final = (result.maxSpeed / 3.6);
    const kineticEnergy = 0.5 * weightKg * Math.pow(v_final, 2);
    const p_kinetic = kineticEnergy / result.time; // Watts

    // 2. Potential Energy Power (Gravity/Slope)
    // P_gravity = m * g * v_vertical
    // v_vertical = v_horizontal * slope
    const g = 9.81;
    const slopeDecimal = (result.slope || 0) / 100;
    const v_avg = (v_final / 2); // Average speed during 0-100 (approx)
    const p_gravity = weightKg * g * v_avg * slopeDecimal;

    // 3. Estimated Aerodynamic Drag (Approximate for mixed cars)
    // P_drag = 0.5 * rho * Cd * A * v^3
    // We'll use a simplified factor based on average car profiles
    const p_drag = 0.03 * Math.pow(v_avg, 3); 

    // Total Power at Wheels (Watts)
    const p_wheels = p_kinetic + p_gravity + p_drag;

    // Convert Watts to CV (1 CV = 735.5 Watts)
    let cv_estimated = p_wheels / 735.5;

    // 4. Calibration based on Admin References
    // We adjust for drivetrain loss (typically 15-25%) using the reference data
    const calibrationFactor = this.calculateCalibrationFactor(references);
    
    // Apply loss factor (standard ~1.2x to go from wheel to engine)
    const engine_cv = cv_estimated * calibrationFactor;

    return Math.round(engine_cv);
  },

  /**
   * Calculates a correction factor based on known performance points.
   * If no references, uses a standard 1.22x (18% drivetrain loss + friction).
   */
  calculateCalibrationFactor(references: PowerReference[]): number {
    if (!references || references.length === 0) return 1.22;

    // In a future version, this will perform a regression or interpolation
    // between the points to find the most accurate factor for the specific speed/power range.
    return 1.22; 
  }
};
