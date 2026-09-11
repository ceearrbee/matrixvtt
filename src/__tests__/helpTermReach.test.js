/**
 * `helpTermCoverage.test.js` guards one direction: a registered term
 * must have a HelpIcon somewhere, so no copy goes dead. Nothing guarded
 * the other direction, and the gap showed: "ruleset" appeared in twenty
 * user-facing strings with one ⓘ on the setup wizard, and the "prep" ⓘ
 * only rendered once Prep was already on, so the unexplained state was
 * the one without help.
 *
 * A term's icon has to sit on every heading-level surface that uses the
 * word, and must not be gated on the state it explains.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('help reaches the surfaces that use the word', () => {
  it('the ruleset picker in Settings explains itself, as the wizard does', () => {
    expect(read('src/ui/settings/GMSettings.jsx')).toMatch(/term: 'ruleset'/);
  });

  // The resting state is explained by the control's own tooltip rather
  // than a second permanent header button: hovering the thing you do
  // not understand is what a first-time GM actually does, and the
  // first-paint budget should not carry a control for a question asked
  // once. The ⓘ still appears alongside once Prep is open.
  it('the prep toggle explains itself before prep has ever been on', () => {
    const header = read('src/ui/Header.jsx');
    expect(header).toMatch(/term: 'prep'/);
    expect(header, 'the toggle repeats the help copy in its tooltip')
      .toMatch(/title: `\$\{HELP_TERMS\.prep\.short\}/);
  });

  it('the composer OOC pill explains OOC, not just the side panel', () => {
    expect(read('src/ui/composer/dice-controls.jsx')).toMatch(/term: 'ooc'/);
  });
});
