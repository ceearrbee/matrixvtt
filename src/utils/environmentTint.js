/**
 * Resolve an environment descriptor to a single rgba overlay. Pure
 * function so the renderer stays dumb - it just fills a full-map rect
 * with this colour.
 *
 * Two input shapes are accepted:
 *   - string preset: e.g. 'daylight', 'dusk', 'cave'. Used by per-map
 *     `map.env_tint` in fixtures and the demo loader.
 *   - object: { weather, time_of_day }. Time-of-day wins over weather
 *     because darkness is visually dominant.
 */

const TIME_TINTS = {
  day: 'rgba(0,0,0,0)',
  dusk: 'rgba(200,100,30,0.25)',
  night: 'rgba(10,20,60,0.45)',
  dawn: 'rgba(255,180,120,0.2)',
};

const WEATHER_TINTS = {
  clear: 'rgba(0,0,0,0)',
  rain: 'rgba(80,100,120,0.25)',
  fog: 'rgba(220,220,225,0.35)',
  snow: 'rgba(230,240,255,0.3)',
  storm: 'rgba(40,50,70,0.4)',
};

const PRESET_TINTS = {
  daylight: 'rgba(0,0,0,0)',
  dusk:     'rgba(200,100,30,0.25)',
  night:    'rgba(10,20,60,0.45)',
  dawn:     'rgba(255,180,120,0.2)',
  cave:     'rgba(20,15,40,0.6)',
  underwater: 'rgba(40,90,140,0.45)',
  hellscape:  'rgba(120,30,20,0.4)',
};

export function environmentTint(env) {
  if (typeof env === 'string') {
    return PRESET_TINTS[env] ?? 'rgba(0,0,0,0)';
  }
  const time = env?.time_of_day;
  const weather = env?.weather;
  if (time && time !== 'day' && TIME_TINTS[time]) return TIME_TINTS[time];
  if (weather && WEATHER_TINTS[weather]) return WEATHER_TINTS[weather];
  return 'rgba(0,0,0,0)';
}
