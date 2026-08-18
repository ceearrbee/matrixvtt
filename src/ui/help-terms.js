/**
 * Inline-help term registry. Each entry pairs a one-sentence `short`
 * (used as the HelpIcon button's title attribute) with a longer `long`
 * paragraph (rendered in the click-open info modal). Centralizing the
 * copy here keeps it consistent across panels and out of UI files.
 */
export const HELP_TERMS = {
  ruleset: {
    short: 'The game system rules - like D&D 5e or Fate - that determine character math.',
    long: 'A ruleset configures the math and content of your campaign: ability scores, ' +
      'skills, conditions, dice expressions, and which fields appear on character sheets. ' +
      'Roll20 calls this a "character sheet template," Foundry calls it a "game system." ' +
      'You can switch the built-in system at setup or import a custom .vttruleset.json file.',
    docHref: 'docs/RULESET-SPEC.md',
  },
  fog: {
    short: 'Hides parts of the map from players until you reveal them.',
    long: 'Fog of War lets the GM control what players can see on the map. With fog on, ' +
      'players see only the regions you have revealed; turn fog off to share the whole ' +
      'map. Reveal All clears fog without disabling it; Hide All re-covers everything. ' +
      'Player tokens always see their own surroundings within their darkvision radius.',
  },
  initiative: {
    short: 'The combat turn order. Tokens act from highest initiative roll to lowest.',
    long: 'Initiative tracks whose turn it is in combat. Click "Roll Initiative" to roll ' +
      'for every token on the map; the tracker then steps through them in order using ' +
      'Prev / Next. Drag entries to reorder, or use the keyboard arrows when an entry is ' +
      'focused. Each round all action pips reset.',
  },
  ooc: {
    short: 'Out of character: speak as yourself, not as your character.',
    long: 'OOC (out of character) messages are table talk: scheduling, rules questions, ' +
      'jokes. They appear in the chronicle styled differently from in-character speech ' +
      'so the story stays readable. Use the OOC pill in the composer, or the OOC chip ' +
      'in the header for a side panel.',
  },
  scene: {
    short: 'A scene groups chat under a story beat, like a chapter heading.',
    long: 'Starting a scene ("The throne room confrontation") threads the conversation ' +
      'under that beat, so it can be reread on its own later. Scenes live in the ' +
      'Scenes section of the left index; the GM starts and ends them.',
  },
  persona: {
    short: "Speak as an NPC: your messages appear under that character's name.",
    long: 'A persona lets the GM speak as a specific NPC in chat. Pick a persona in the ' +
      "composer and messages are labeled with the NPC's name and portrait until you " +
      'switch back to speaking as yourself.',
  },
};
