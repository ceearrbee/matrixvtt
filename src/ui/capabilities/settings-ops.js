/**
 * settings-ops.js - narrow capability object consumed by Settings.jsx.
 *
 * Settings.jsx reads display data directly off `ui` (presets, current
 * settings, room id, chat announcements) but routes every action
 * (save / delete / export / import) through this surface. New
 * feature modals should prefer this pattern over taking the full
 * `ui` controller as a prop.
 */

export function createSettingsOps(ui) {
  return {
    async saveSettings({ settings, announcements }) {
      if (settings) {
        // Merge: updateSettings replaces the record, and the form
        // doesn't carry active_map_id.
        await ui.state.updateSettings({ ...ui.state.settings, ...settings });
        ui._syncDisplayName();
      }
      if (announcements && ui.chat) {
        ui.chat.setAnnouncementSettings(announcements);
      }
    },
    deleteSession() { return ui.deleteSession(); },
    exportRuleset() { return ui.exportRuleset(); },
    importRuleset(file) { return ui.importRuleset(file); },
  };
}
