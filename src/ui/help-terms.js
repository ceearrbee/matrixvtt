/**
 * Inline-help term registry. Each entry pairs a `title` (the modal
 * heading, in the words the UI itself uses), a one-sentence `short`
 * (the HelpIcon button's title attribute) and a longer `long`
 * paragraph (the click-open info modal body). Centralizing the copy
 * here keeps it consistent across panels and out of UI files.
 *
 * The key is an identifier and never reaches the user: deriving the
 * heading from it showed "About: Msgtype" over a pill labelled OOC.
 */
export const HELP_TERMS = {
  ruleset: {
    title: 'Game systems',
    short: 'The game system rules - like D&D 5e or Fate - that determine character math.',
    long: 'A ruleset configures the math and content of your campaign: ability scores, ' +
      'skills, conditions, dice expressions, and which fields appear on character sheets. ' +
      'Roll20 calls this a "character sheet template," Foundry calls it a "game system." ' +
      'You can switch the built-in system at setup or import a custom .vttruleset.json file.',
    docPath: 'RULESET-SPEC',
  },
  fog: {
    title: 'Fog of war',
    short: 'Hides parts of the map from players until you reveal them.',
    long: 'Fog of War lets the GM control what players can see on the map. With fog on, ' +
      'players see only the regions you have revealed; turn fog off to share the whole ' +
      'map. Reveal All clears fog without disabling it; Hide All re-covers everything. ' +
      'Player tokens always see their own surroundings within their darkvision radius.',
  },
  initiative: {
    title: 'Initiative',
    short: 'The combat turn order. Tokens act from highest initiative roll to lowest.',
    long: 'Initiative tracks whose turn it is in combat. Click "Roll Initiative" to roll ' +
      'for every token on the map; the tracker then steps through them in order using ' +
      'Prev / Next. Drag entries to reorder, or use the keyboard arrows when an entry is ' +
      'focused. Each round all action pips reset.',
  },
  ooc: {
    title: 'Out of character',
    short: 'Out of character: speak as yourself, not as your character.',
    long: 'OOC (out of character) messages are table talk: scheduling, rules questions, ' +
      'jokes. They appear in the chat log styled differently from in-character speech ' +
      'so the story stays readable. Use the OOC pill in the composer, or the OOC chip ' +
      'in the header for a side panel.',
  },
  scene: {
    title: 'Scenes',
    short: 'A scene groups chat under a story beat, like a chapter heading.',
    long: 'Starting a scene ("The throne room confrontation") threads the conversation ' +
      'under that beat, so it can be reread on its own later. Scenes live in the ' +
      'Scenes section of the left index; the GM starts and ends them.',
  },
  persona: {
    title: 'Speaking as someone else',
    short: "Speak as an NPC: your messages appear under that character's name.",
    long: 'A persona lets the GM speak as a specific NPC in chat. Pick a persona in the ' +
      "composer and messages are labeled with the NPC's name and portrait until you " +
      'switch back to speaking as yourself.',
  },
  prep: {
    title: 'The prep workspace',
    short: 'The GM workspace: authoring tools that stay out of the way during play.',
    long: 'Prep is a GM-only workspace layer, separate from whether the table is in ' +
      'narrative or combat. Turning it on (Alt+P, or the Prep button in the header) ' +
      'brings out the scene-building tools - walls, lights, templates, the party ' +
      'roster - so they are not fanned out permanently while the table is playing.',
  },
  msgtype: {
    title: 'Say, Describe and Notice',
    short: 'How Matrix labels a chat line: ordinary speech, an action, or a system note.',
    long: 'Matrix tags every message with a type. m.text is ordinary speech, what the ' +
      'composer sends by default. m.emote is an action in the third person, the ' +
      '"/me draws her sword" form. m.notice is a system or bot line, which most ' +
      'Matrix clients render dimmer and never notify on - MatrixVTT uses it for dice ' +
      'results and automated announcements so they do not read as someone talking.',
  },
  tone: {
    title: 'Tone',
    short: 'A colour and a name for how a line is delivered, shown beside your message.',
    long: 'A tone tags a chat line with how it is said: whispered, shouted, wary. ' +
      'It renders as a small coloured label beside the message so the table can ' +
      'read delivery at a glance. Tone is about how you say something; speaking ' +
      'as a character is about who is saying it, and the two combine freely.',
  },
  tombstone: {
    title: 'How deleting works here',
    short: 'An empty event that marks something as deleted, because Matrix keeps history.',
    long: 'A Matrix room is an append-only log: nothing is ever really removed. To delete ' +
      'an entity, MatrixVTT writes an empty event over it - a tombstone - and every ' +
      'client treats that as "gone". This is why a deleted token can reappear if an ' +
      'older client replays stale state, and why wiping a room writes one tombstone ' +
      'per entity rather than issuing a single delete.',
  },
};
