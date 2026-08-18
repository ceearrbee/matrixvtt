import { exportCampaign } from '../../state/campaign-sync.js';

export async function exportState(ui) {
  const campaign = exportCampaign(ui.state);
  const json = JSON.stringify(campaign, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `campaign-${ui.state.settings.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
  a.click();

  URL.revokeObjectURL(url);
  ui._toast?.(`Exported campaign "${ui.state.settings.name}"`, 'success');
}
