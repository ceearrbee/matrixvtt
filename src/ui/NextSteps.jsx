/**
 * NextSteps.jsx - the shell's first-run surface: one row of chips that
 * tick themselves from room state, each chip a live CTA.
 *
 * Replaces the transient "you are the GM" toast at the end of setup,
 * which was the only confirmation a GM got, and carries the invite link
 * that lived nowhere in the funnel.
 *
 * Deliberately one row. The first shape was a four-row list carrying a
 * hint sentence and a separate button per row - about a quarter of the
 * shell height, sat on top of the map. A first-run aid that costs that
 * much screen is the density problem it exists to answer. The hints
 * survive as each chip's tooltip.
 */

import { h } from 'preact';
import {
  mapsSignal, tokensSignal, charactersSignal, initiativeSignal, roomMembersSignal,
} from '../state/signals.js';
import { useStorageSubscription } from './hooks/use-storage.js';
import { STORAGE_KEYS, TABS } from '../utils/constants.js';
import { nextStepsFor, NEXT_STEP_KEYS } from './next-steps.js';
import { showInvitePlayerModal } from './InvitePlayerModal.jsx';
import { CheckIcon } from './icons/index.jsx';

function runStep(ui, step) {
  if (step.key === NEXT_STEP_KEYS.MAP) return ui.openMapsPanel?.();
  if (step.key === NEXT_STEP_KEYS.INVITE) return showInvitePlayerModal(ui);
  if (step.key === NEXT_STEP_KEYS.TOKEN) return ui.beginTokenPlacement?.();
  if (step.key === NEXT_STEP_KEYS.COMBAT) return ui.rollInitiative?.();
  // Claiming happens on the sheet, so send the player to the roster to
  // pick one; creating is the wizard.
  if (step.action === 'claim') return ui.switchTab?.(TABS.PARTY);
  return ui.showCharacterWizard?.();
}

export function NextSteps({ ui }) {
  const myUserId = ui.widgetManager?.userId ?? null;
  const [dismissed, setDismissed] = useStorageSubscription(
    STORAGE_KEYS.HIDE_NEXT_STEPS, { userId: myUserId },
  );
  // Subscribe to every collection a step reads, so a step ticks the
  // moment the room state that completes it lands.
  mapsSignal.value; tokensSignal.value; charactersSignal.value;
  initiativeSignal.value; roomMembersSignal.value;

  if (dismissed === '1') return null;

  const steps = nextStepsFor({
    isGM: ui.state?.isGM?.() === true,
    memberCount: ui.state?.roomMembers?.length ?? 0,
    maps: ui.state?.maps,
    tokens: ui.state?.tokens,
    characters: ui.state?.characters,
    initiative: ui.state?.initiative,
    myUserId,
  });
  if (steps.every((s) => s.done)) return null;

  return h('section', { class: 'next-steps', 'aria-labelledby': 'next-steps-title' }, [
    h('h2', { id: 'next-steps-title', class: 'next-steps__title' }, 'Next steps'),
    ...steps.map((step) => h('button', {
      key: step.key,
      type: 'button',
      class: 'dbt dbt--sm next-steps__chip',
      'data-step': step.key,
      'data-done': String(step.done),
      // Done steps stay in place so progress reads, but say so rather
      // than inviting the click again.
      'aria-label': step.done ? `${step.label} (done)` : step.label,
      title: step.hint,
      onClick: () => runStep(ui, step),
    }, [
      step.done && h('span', { class: 'next-steps__mark', 'aria-hidden': 'true' }, h(CheckIcon, {})),
      h('span', { class: 'next-steps__label' }, step.label),
    ])),
    h('button', {
      type: 'button', class: 'standalone-link-btn next-steps__dismiss',
      'aria-label': 'Dismiss the next-steps checklist',
      onClick: () => setDismissed('1'),
    }, 'Dismiss'),
  ]);
}
