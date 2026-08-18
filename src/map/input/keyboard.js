
import { moveTokenBy } from '../actions/tokens.js';

const ARROW_DELTAS = {
  ArrowLeft:  { dx: -1, dy: 0 },
  ArrowRight: { dx: 1,  dy: 0 },
  ArrowUp:    { dx: 0,  dy: -1 },
  ArrowDown:  { dx: 0,  dy: 1 },
};

function isFormField(el) {
  return el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

function announce(message) {
  if (typeof document === 'undefined') return;
  let region = document.getElementById('map-live-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'map-live-region';
    region.className = 'sr-only';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    document.body.appendChild(region);
  }
  region.textContent = message;
}

function tokenName(mr, id) {
  return mr.state.tokens.get(id)?.name || 'token';
}

export function setupKeyboard(mr) {
  const onKeydown = (e) => {
    if (isFormField(document.activeElement)) return;

    if (e.code === 'Space') {
      if (!mr._spaceDown) {
        mr._spaceDown = true;
        const c = mr.stage?.container?.() ?? mr.canvas;
        if (c?.style) c.style.cursor = 'grab';
      }
      return;
    }

    if (e.key === 'Escape') {
      if (mr._moveMode) {
        const origin = mr._moveOrigin;
        mr._moveMode = false;
        mr._moveOrigin = null;
        if (origin && mr.selectedToken) {
          const t = mr.state.tokens.get(mr.selectedToken);
          if (t && (t.col !== origin.col || t.row !== origin.row)) {
            mr.state.updateToken(mr.selectedToken, { ...t, col: origin.col, row: origin.row });
          }
        }
        announce('Movement cancelled.');
        mr.render?.();
      }
      if (mr.areaSelectionMode) mr.cancelAreaSelection();
      return;
    }

    if (mr._moveMode && e.key === 'Enter') {
      e.preventDefault();
      mr._moveMode = false;
      mr._moveOrigin = null;
      announce('Movement committed.');
      mr.render?.();
      return;
    }

    if ((e.key === 'm' || e.key === 'M') && mr.selectedToken) {
      const t = mr.state.tokens.get(mr.selectedToken);
      mr._moveMode = true;
      mr._moveOrigin = t ? { col: t.col ?? 0, row: t.row ?? 0 } : null;
      announce(`Movement mode on for ${tokenName(mr, mr.selectedToken)}. Arrow keys to move, Enter to commit, Escape to cancel.`);
      mr.render?.();
      return;
    }

    if (mr._moveMode && ARROW_DELTAS[e.key] && mr.selectedToken) {
      e.preventDefault();
      const { dx, dy } = ARROW_DELTAS[e.key];
      const step = e.shiftKey ? 5 : 1;
      moveTokenBy(mr, mr.selectedToken, dx * step, dy * step);
    }
  };

  const onKeyup = (e) => {
    if (e.code === 'Space') {
      mr._spaceDown = false;
      const c = mr.stage?.container?.() ?? mr.canvas;
      if (c?.style && !mr._isPanning) c.style.cursor = 'default';
    }
  };

  document.addEventListener('keydown', onKeydown);
  document.addEventListener('keyup', onKeyup);
  return () => {
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('keyup', onKeyup);
  };
}
