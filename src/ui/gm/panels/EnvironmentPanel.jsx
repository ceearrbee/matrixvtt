import { h } from 'preact';
import { showErrorNotification } from '../../../utils/errorHandling.js';

/** @param {{ ui: any, gm?: any }} props */
export function EnvironmentPanel(props) {
  const { ui } = props;
  const env = ui.state.settings?.environment ?? {};
  const update = async patch => {
    const next = { ...ui.state.settings, environment: { ...env, ...patch } };
    await ui.state.updateSettings(next).catch(showErrorNotification);
    ui.mapRenderer?.render?.();
  };
  return h('div', { class: 'gm-panel gm-panel--env stack-sm', style: 'padding:12px;' }, [
    h('label', { class: 'muted-small', for: 'env-time-of-day' }, 'Time of day'),
    h(
      'select',
      {
        id: 'env-time-of-day',
        class: 'form-input',
        value: env.time_of_day ?? 'day',
        onChange: e => update({ time_of_day: e.target.value || undefined }),
      },
      ['day', 'dusk', 'night', 'dawn'].map(v => h('option', { value: v, key: v }, v))
    ),
    h('label', { class: 'muted-small', for: 'env-weather' }, 'Weather'),
    h(
      'select',
      {
        id: 'env-weather',
        class: 'form-input',
        value: env.weather ?? 'clear',
        onChange: e => update({ weather: e.target.value || undefined }),
      },
      ['clear', 'rain', 'fog', 'snow', 'storm'].map(v => h('option', { value: v, key: v }, v))
    ),
  ]);
}
