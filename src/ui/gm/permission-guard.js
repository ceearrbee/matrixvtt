
import { logger } from '../../utils/logger.js';

export function denyIfNotGM(ui, actionLabel, toastMsg) {
  if (ui.state.isGM()) return false;
  logger.error('UI', `Permission denied - ${actionLabel}`);
  ui._toast(toastMsg);
  return true;
}
