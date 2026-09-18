/**
 * The opt-in for turn notifications.
 *
 * The permission prompt is raised here and nowhere else: a browser
 * asked for permission on page load is a browser the player denies
 * out of reflex, and a denial is hard to walk back.
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { getNotifyPrefs, setNotifyPref } from './my-turn.js';
import {
  notificationsAvailable, notificationPermission,
  requestNotificationPermission, playTurnChime,
} from './desktop.js';

export function TurnNotifySettings({ ui }) {
  const userId = ui?.state?.widgetManager?.userId ?? ui?.widgetManager?.userId ?? null;
  const [prefs, setPrefs] = useState(() => getNotifyPrefs(userId));
  const [permission, setPermission] = useState(() => notificationPermission());

  const onDesktop = async (e) => {
    const wanted = e.target.checked;
    if (wanted && notificationPermission() !== 'granted') {
      const result = await requestNotificationPermission();
      setPermission(result);
      if (result !== 'granted') {
        setNotifyPref(userId, 'desktop', false);
        setPrefs({ ...prefs, desktop: false });
        return;
      }
    }
    setNotifyPref(userId, 'desktop', wanted);
    setPrefs({ ...prefs, desktop: wanted });
  };

  const onSound = (e) => {
    const wanted = e.target.checked;
    setNotifyPref(userId, 'sound', wanted);
    setPrefs({ ...prefs, sound: wanted });
    if (wanted) playTurnChime();
  };

  const blocked = permission === 'denied';
  return h('div', { class: 'form-group' }, [
    h('label', { class: 'form-label' }, 'When it is your turn'),
    notificationsAvailable() && h('label', { class: 'settings-toggle' }, [
      h('input', {
        type: 'checkbox', id: 'notify-turn-desktop',
        checked: prefs.desktop, disabled: blocked, onChange: onDesktop,
      }),
      h('span', null, 'Notify me when the tab is in the background'),
    ]),
    h('label', { class: 'settings-toggle' }, [
      h('input', {
        type: 'checkbox', id: 'notify-turn-sound',
        checked: prefs.sound, onChange: onSound,
      }),
      h('span', null, 'Play a chime'),
    ]),
    h('small', { class: 'settings-hint' }, blocked
      ? 'This browser is blocking notifications for the site. Allow them in the address bar to turn this on.'
      : 'The tab title always marks your turn. These add to it.'),
  ]);
}
