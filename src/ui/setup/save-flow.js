
import { importCampaign } from '../import-export.js';
import { runWithProgress, waitForQueueDrain } from '../progress-modal.js';
import { bumpLogVersion } from '../../state/ui-signals.js';
import {
  tombstoneStaleEvents, _fetchStaleVttEvents,
} from '../setup-tombstone.js';
import {
  saveInitialState, verifyInitialSave, countInitialSaveSteps,
} from '../setup-persistence.js';
import { maybeAutoStartTour } from '../onboarding-tour.js';

/**
 * @typedef {Object} WizardChoice
 * @property {'blank'} kind
 * @property {string} [campaignName]
 * @property {string} [gameSystem]
 * @property {{ live_token_drag: boolean, enable_chat_announcements: boolean }} [performance]
 * @property {{campaign?: File, ruleset?: File, characters?: File, npcs?: File}} [imports]
 */

export async function runSetupFlow(ui, /** @type {WizardChoice} */ choice, onDone) {
  ui.state.setCleaningUp(true);
  try {
    const stale = await _fetchStaleVttEvents(ui);

    ui.state.initBlankCampaign(choice.campaignName || 'New Campaign', choice.gameSystem);
    await _applyImports(ui, choice.imports ?? {});

    await runWithProgress([
      { title: 'Clearing previous session', total: stale.length,
        run: (onProgress) => tombstoneStaleEvents(ui, stale, onProgress) },
      { title: 'Saving campaign', total: countInitialSaveSteps(ui),
        run: (onProgress) => saveInitialState(ui, onProgress) },
      { title: 'Finalizing writes', total: 0,
        run: (onProgress, setTotal) => waitForQueueDrain(ui.state, onProgress, setTotal) },
      { title: 'Verifying', total: 1,
        run: async (onProgress) => {
          const result = await verifyInitialSave(ui, stale);
          onProgress(1, result.verified
            ? 'all writes confirmed'
            : `${result.discrepancies.length} discrepanc${result.discrepancies.length === 1 ? 'y' : 'ies'}`);
          if (!result.verified) {
            const sample = result.discrepancies.slice(0, 3)
              .map((d) => `${d.type}#${d.id}: ${d.issue}`).join('; ');
            throw new Error(
              `${result.discrepancies.length} write(s) didn't land on the server (e.g. ${sample}). Reload and try again, or export a backup first.`,
            );
          }
        } },
      // Publish a Yjs snapshot now that the seed writes are in. Without
      // this, loadInitialState on the next reload finds nothing in /state
      // (Yjs data lives in com.matrixvtt.yjs.update *timeline* events, which
      // arrive asynchronously via /sync) - so renderUI hits noMap and the
      // wizard fires every reload. publishYjsSnapshot returns false if any
      // chunk fails (rate limit, network). If it fails we MUST NOT finalize
      // - throw so the wizard stays open and the user can retry, rather than
      // closing onto a fragile room that re-fires the wizard on reload.
      { title: 'Saving snapshot', total: 1,
        run: async (onProgress) => {
          const { publishYjsSnapshot } = await import('../../state/yjs-snapshot-publish.js');
          const published = await publishYjsSnapshot(ui.state);
          onProgress(1, published ? 'snapshot saved' : 'failed');
          if (!published) {
            throw new Error(
              "Couldn't save the campaign snapshot to the server: your room isn't " +
              'persisted yet (often a homeserver rate limit). Wait a few seconds and retry.',
            );
          }
        } },
    ]);
  } finally {
    ui.state.setCleaningUp(false);
  }

  // Only reached when every phase above (including the snapshot publish)
  // succeeded - so finalizing here can't strand a half-saved room.
  ui.activityLog = [];
  ui._seenLogEventIds = new Set();
  onDone();
  ui.updateMapPanel();
  bumpLogVersion();

  // Tell the user the wizard finished. Without this, the progress
  // modal disappears and they're left staring at the map with no
  // confirmation of who they are or what just happened. initBlankCampaign
  // populates settings.name, so the toast can read the campaign name back.
  const campaignName = ui.state?.settings?.name || 'Your campaign';
  ui._toast?.(`${campaignName} ready. You are the GM.`, 'success');

  maybeAutoStartTour({ ui });
}

async function _applyImports(ui, files) {
  // Full campaign archive wins: it replaces entities produced by
  // initBlankCampaign, so per-type imports on top would be misleading.
  if (files.campaign) {
    try {
      const data = JSON.parse(await files.campaign.text());
      importCampaign(ui.state, data);
      ui._toast(`Imported campaign "${data.settings?.name ?? 'unnamed'}"`, 'success');
    } catch (err) {
      ui._toast(`Campaign import failed: ${err.message}`, 'error');
    }
    return;
  }

  if (files.ruleset) {
    try {
      const data = JSON.parse(await files.ruleset.text());
      if (data.vtt_export_type !== 'ruleset' || !Array.isArray(data.attributes)) {
        throw new Error('not a valid ruleset file');
      }
      // eslint-disable-next-line no-unused-vars
      const { vtt_export_type, vtt_version, system: importedSystem, ...systemConfig } = data;
      ui.state.settings = {
        ...ui.state.settings,
        system: importedSystem || 'custom',
        systemConfig,
      };
    } catch (err) {
      ui._toast(`Ruleset import failed: ${err.message}`, 'error');
    }
  }

  if (files.characters) {
    try { await ui.importMarkdown(await files.characters.text()); }
    catch (err) { ui._toast(`Characters import failed: ${err.message}`, 'error'); }
  }
  if (files.npcs) {
    try { await ui.importMarkdown(await files.npcs.text()); }
    catch (err) { ui._toast(`NPCs import failed: ${err.message}`, 'error'); }
  }
}
