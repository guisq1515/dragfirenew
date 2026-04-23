import { PowerReference, RunResult } from '../types';

/**
 * Service to estimate vehicle horsepower (CV) and calculate performance points.
 * Accounts for vehicle weight and road incline (slope) to normalize results.
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
    // v_vertical = v_avg_horizontal * sin(theta)
    const g = 9.81;
    const slopeDecimal = (result.slope || 0) / 100;
    
    // Improved v_avg estimation (more weight on the latter half where air resistance and slope matter more)
    const v_avg = (v_final * 0.7); 
    
    // P = F * v. F_gravity = m * g * sin(theta). For small angles sin(theta) approx slope.
    const p_gravity = weightKg * g * v_avg * slopeDecimal;

    // 3. Estimated Aerodynamic Drag (Approximate for mixed cars)
    // P_drag = 0.5 * rho * Cd * A * v^3
    const p_drag = 0.5 * 1.225 * 0.32 * 2.2 * Math.pow(v_avg, 3); 

    // Total Power at Wheels (Watts)
    const p_wheels = p_kinetic + p_gravity + p_drag;

    // Convert Watts to CV (1 CV = 735.5 Watts)
    let cv_estimated = p_wheels / 735.5;

    // 4. Calibration based on Admin References
    const calibrationFactor = this.calculateCalibrationFactor(references);
    
    // Apply loss factor (standard ~1.22x to go from wheel to engine)
    const engine_cv = cv_estimated * calibrationFactor;

    // Anti-cheat / Reality check
    if (engine_cv < 0) return 0;
    
    return Math.round(engine_cv);
  },

  /**
   * Calculates performance points based on horsepower and weight.
   * This score is "slope-normalized" because horsepower already accounts for slope.
   */
  calculateScore(hp: number, weightKg: number, time: number): number {
    if (hp <= 0 || weightKg <= 0) return 0;
    
    // The score represents the "Effective Performance" of the vehicle during the run.
    // Since 'hp' is already slope-compensated, HP/Weight is our slope-neutral base.
    // We multiply by a factor to make it a large, rewarding number (e.g., 5000-15000).
    const powerToWeight = hp / (weightKg / 1000); // HP/Ton
    
    // We add a small bonus for consistency/efficiency, but the primary driver is the 
    // realized power-to-weight ratio.
    const baseScore = powerToWeight * 50; 
    
    // Add a "Launch Quality" factor (optional, but let's keep it simple for now)
    // A better score means you exploited the car's potential better.
    return Math.round(baseScore);
  },

  /**
   * Calculates a correction factor based on known performance points.
   */
  calculateCalibrationFactor(references: PowerReference[]): number {
    if (!references || references.length === 0) return 1.22;
    
    // Simple dynamic regression: average of (True HP / Estimated HP at wheels)
    // This allows us to use verified runs to calibrate the entire system.
    let totalFactor = 0;
    let count = 0;
    
    references.forEach(ref => {
      if (ref.estimatedWheelHp > 0 && ref.trueEngineHp > 0) {
        totalFactor += ref.trueEngineHp / ref.estimatedWheelHp;
        count++;
      }
    });
    
    return count > 0 ? totalFactor / count : 1.22; 
  }
};
