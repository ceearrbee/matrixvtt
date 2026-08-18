/**
 * EmojiPicker.jsx - floating emoji picker with search, category tabs, and click-to-pick grid.
 *
 * @param {{ onPick: (char: string) => void, onClose?: () => void, anchorRect?: DOMRect | { top: number, left: number, bottom: number } }} props
 */

import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import emojis from '../content/emojis.json' with { type: 'json' };

const CATEGORIES = ['people', 'nature', 'food', 'activity', 'travel', 'objects', 'symbols', 'flags'];

const CATEGORY_LABELS = {
  people: '🙂',
  nature: '🌿',
  food: '🍕',
  activity: '🎲',
  travel: '✈️',
  objects: '📚',
  symbols: '❤️',
  flags: '🏁',
};

function panelPosition(anchorRect) {
  if (!anchorRect) {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }
  return {
    top: `${anchorRect.bottom + 4}px`,
    left: `${anchorRect.left}px`,
  };
}

/** @param {{ onPick: (char: string) => void, onClose?: () => void, anchorRect?: DOMRect | { top: number, left: number, bottom: number } }} props */
export function EmojiPicker({ onPick, onClose, anchorRect }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('people');
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (searchRef.current) {
      searchRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    const handleMouseDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) && onClose) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onClose]);

  const query = search.trim().toLowerCase();
  const filtered = query
    ? emojis.filter((e) => e.name.includes(query) || e.aliases.some((a) => a.includes(query)))
    : emojis.filter((e) => e.category === activeCategory);

  const pos = panelPosition(anchorRect);

  return h(
    'div',
    {
      ref: panelRef,
      class: 'emoji-picker',
      style: {
        position: 'fixed',
        zIndex: 1000,
        background: 'var(--color-background-secondary)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: '8px',
        padding: '8px',
        width: '280px',
        maxHeight: '360px',
        display: 'flex',
        flexDirection: 'column',
        ...pos,
      },
    },
    [
      h('input', {
        ref: searchRef,
        type: 'search',
        class: 'emoji-search',
        'aria-label': 'Search emojis',
        placeholder: 'Search emojis…',
        value: search,
        onInput: (e) => setSearch(e.target.value),
        style: {
          marginBottom: '6px',
          padding: '4px 6px',
          borderRadius: '4px',
          border: '1px solid var(--color-border-secondary)',
          background: 'var(--color-background-tertiary)',
          color: 'var(--color-text-primary)',
          fontSize: '13px',
          width: '100%',
          boxSizing: 'border-box',
        },
      }),
      !query &&
        h(
          'div',
          {
            class: 'emoji-categories',
            style: {
              display: 'flex',
              gap: '2px',
              marginBottom: '6px',
              flexWrap: 'wrap',
            },
          },
          CATEGORIES.map((cat) =>
            h(
              'button',
              {
                type: 'button',
                class: `category-tab${activeCategory === cat ? ' category-tab--active' : ''}`,
                title: cat,
                onClick: () => setActiveCategory(cat),
                style: {
                  flex: '1',
                  fontSize: '16px',
                  padding: '3px',
                  background: activeCategory === cat ? 'var(--color-background-tertiary)' : 'transparent',
                  border: activeCategory === cat
                    ? '1px solid var(--color-border-secondary)'
                    : '1px solid transparent',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: 'var(--color-text-primary)',
                },
              },
              CATEGORY_LABELS[cat],
            ),
          ),
        ),
      h(
        'div',
        {
          class: 'emoji-grid',
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: '4px',
            overflowY: 'auto',
            flex: '1',
          },
        },
        filtered.map((entry) =>
          h(
            'button',
            {
              type: 'button',
              class: 'emoji-cell',
              title: entry.name,
              onClick: () => onPick(entry.char),
              style: {
                fontSize: '20px',
                padding: '4px',
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: '4px',
                cursor: 'pointer',
                lineHeight: '1',
              },
            },
            entry.char,
          ),
        ),
      ),
    ],
  );
}
