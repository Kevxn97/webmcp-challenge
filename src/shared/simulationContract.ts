export const TICK_MINUTES = 15 as const;
export const TOTAL_TICKS = 64 as const;
export const SIMULATION_HORIZON_SHIFTS = [1] as const;

export const PACKAGING_LOCK_EFFECTIVE_TICK = 16 as const;
export const PACKAGING_LOCK_EFFECTIVE_MINUTES =
  PACKAGING_LOCK_EFFECTIVE_TICK * TICK_MINUTES;
