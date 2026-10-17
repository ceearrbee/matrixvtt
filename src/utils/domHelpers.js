import { normalizeEmDashes } from './format.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => normalizeEmDashes(String(s ?? '')).replace(/[&<>"']/g, c => ESC[c]);
export const safeHtml = s => String(s ?? '');

