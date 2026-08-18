import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { act } from 'preact/test-utils';
import { ScenesForum } from '../ui/ScenesForum.jsx';
import { activeSceneSignal, logVersionSignal } from '../state/ui-signals.js';

function makeUi(activityLog = []) {
  return {
    state: {
      widgetManager: { roomId: '!r:s', userId: '@gm:s' },
    },
    widgetManager: { userId: '@gm:s' },
    activityLog,
    enterScene: vi.fn(),
    leaveScene: vi.fn(),
  };
}

const sceneEntry = (over = {}) => ({
  icon: '🎬',
  html: '<div>scene</div>',
  text: 'scene',
  ts: '12:00',
  eventId: '$scene-1',
  sender: '@gm:s',
  isSceneRoot: true,
  sceneTitle: 'The Drowned Chapel',
  threadOf: null,
  long: false,
  ...over,
});

const replyEntry = (rootId, over = {}) => ({
  icon: '💬',
  html: '<b>player</b>: hello',
  text: 'player: hello',
  ts: '12:01',
  eventId: `$reply-${Math.random().toString(36).slice(2, 8)}`,
  sender: '@player:s',
  threadOf: rootId,
  ...over,
});

describe('ScenesForum', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    activeSceneSignal.value = null;
    logVersionSignal.value = 0;
  });
  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('renders empty state when no scene roots exist', () => {
    const ui = makeUi([]);
    act(() => render(h(ScenesForum, { ui }), host));
    expect(host.textContent).toContain('No scenes yet');
  });

  it('renders one card per scene root, sorted as in activityLog', () => {
    const ui = makeUi([
      sceneEntry({ eventId: '$s1', sceneTitle: 'Scene One' }),
      sceneEntry({ eventId: '$s2', sceneTitle: 'Scene Two' }),
    ]);
    act(() => render(h(ScenesForum, { ui }), host));
    const cards = host.querySelectorAll('.scene-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Scene One');
    expect(cards[1].textContent).toContain('Scene Two');
  });

  it('counts replies by threadOf', () => {
    const ui = makeUi([
      sceneEntry({ eventId: '$root', sceneTitle: 'Replied Scene' }),
      replyEntry('$root'),
      replyEntry('$root'),
      replyEntry('$root'),
    ]);
    act(() => render(h(ScenesForum, { ui }), host));
    expect(host.querySelector('.scene-card').textContent).toContain('3 replies');
  });

  it('shows Active badge and Leave button on the currently active scene', () => {
    activeSceneSignal.value = { eventId: '$root', title: 'Active Scene' };
    const ui = makeUi([sceneEntry({ eventId: '$root', sceneTitle: 'Active Scene' })]);
    act(() => render(h(ScenesForum, { ui }), host));
    const card = host.querySelector('.scene-card');
    expect(card.classList.contains('scene-card--active')).toBe(true);
    expect(card.textContent).toContain('Active');
    const actionBtns = card.querySelectorAll('.scene-card__actions button');
    expect([...actionBtns].some((b) => b.textContent === 'Leave')).toBe(true);
  });

  it('clicking Enter calls ui.enterScene with the event id and title', () => {
    const ui = makeUi([sceneEntry({ eventId: '$s', sceneTitle: 'Pick me' })]);
    act(() => render(h(ScenesForum, { ui }), host));
    const enter = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Enter');
    expect(enter).toBeTruthy();
    act(() => enter.click());
    expect(ui.enterScene).toHaveBeenCalledWith('$s', 'Pick me');
  });

  it('clicking Leave calls ui.leaveScene', () => {
    activeSceneSignal.value = { eventId: '$root', title: 'X' };
    const ui = makeUi([sceneEntry({ eventId: '$root', sceneTitle: 'X' })]);
    act(() => render(h(ScenesForum, { ui }), host));
    const leave = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Leave');
    act(() => leave.click());
    expect(ui.leaveScene).toHaveBeenCalled();
  });

  it('Expand toggle renders the ThreadView inline', () => {
    const ui = makeUi([sceneEntry()]);
    act(() => render(h(ScenesForum, { ui }), host));
    expect(host.querySelector('.scene-card__thread')).toBeNull();
    const expand = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Expand thread');
    act(() => expand.click());
    expect(host.querySelector('.scene-card__thread')).not.toBeNull();
  });
});
