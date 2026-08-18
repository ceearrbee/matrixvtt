/**
 * LogContainer.jsx - centre-column messages surface.
 *
 * Reads the active channel from `activeChannelSignal` (driven by
 * ChannelsRail) and renders the matching view:
 *   - 'live'      → chronological LogPanel
 *   - 'scene:*'   → ScenesForum (forum view of scene threads)
 *   - 'notes:*'   → fall through to LogPanel (the rail's note rows
 *                   open FloatingDocs directly; the centre stays on
 *                   the chronological log)
 *
 * The internal live/scenes sub-tabs the previous incarnation owned
 * have been retired - channel selection lives in the rail now.
 */

import { h } from 'preact';
import { LogPanel } from './LogPanel.jsx';
import { ScenesForum } from './ScenesForum.jsx';
import { activeChannelSignal } from '../state/ui-signals.js';
import { CHANNEL_KEYS } from '../utils/constants.js';

export function LogContainer({ ui }) {
  const channel = activeChannelSignal.value || CHANNEL_KEYS.LIVE;
  const isScene = typeof channel === 'string' && channel.startsWith(CHANNEL_KEYS.SCENE_PREFIX);
  const Content = isScene ? ScenesForum : LogPanel;
  return h('div', { class: 'log-container', 'data-channel': channel },
    h('div', { class: 'log-container__content', role: 'tabpanel' },
      h(Content, { ui, key: isScene ? 'scenes' : 'live' })));
}
