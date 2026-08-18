/**
 * ui-lifecycle.js - barrel re-export for UIController lifecycle pieces.
 *   - lifecycle-init.js  : init + destroy + window listener setup/teardown
 *   - chat-send.js       : outbound chat + local echo
 *   - render-policy.js   : initial render + welcome/wizard decision tree
 *   - resize-handlers.js : side-panel drag-to-resize
 */

export { initUIController, destroyUI } from './lifecycle-init.js';
export { sendChatMessage } from './chat-send.js';
export { renderUI } from './render-policy.js';
export { setupResizeHandlers } from './resize-handlers.js';
