import { defineConfig } from 'vitepress';

// Follow the app's base path so `scripts/package.sh <url>` produces a
// docs site that works under any deploy prefix, not just GitHub Pages.
const appBase = process.env.VITE_BASE || '/matrixvtt/';

export default defineConfig({
  title: 'MatrixVTT',
  description: 'Matrix-native virtual tabletop - docs, file format specs, and architecture.',
  base: `${appBase}docs/`,
  outDir: '../dist/docs',
  cleanUrls: true,
  lang: 'en-US',
  ignoreDeadLinks: true,

  rewrites: {
    '../README.md':      'contributing/readme.md',
  },

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'File Formats', link: '/formats/campaign' },
      { text: 'Architecture', link: '/ARCHITECTURE' },
      { text: 'App', link: appBase },
    ],

    sidebar: [
      {
        text: 'Playing',
        items: [
          { text: 'Running Your First Game', link: '/guide/gm-quickstart' },
          { text: 'Live Playtest Checklist', link: '/guide/live-playtest' },
        ],
      },
      {
        text: 'Getting Started',
        items: [
          { text: 'Overview',       link: '/' },
          { text: 'Local Setup',    link: '/SETUP' },
          { text: 'README',         link: '/contributing/readme' },
        ],
      },
      {
        text: 'File Formats',
        items: [
          { text: 'Campaign Archive (.json)', link: '/formats/campaign' },
          { text: 'Ruleset (.vttruleset.json)', link: '/formats/ruleset' },
          { text: 'Characters (.md)', link: '/formats/characters' },
          { text: 'NPCs (.md)',       link: '/formats/npcs' },
        ],
      },
      {
        text: 'Architecture',
        items: [
          { text: 'Architecture Overview', link: '/ARCHITECTURE' },
          { text: 'Data Model Spec',       link: '/DATA-MODEL-SPEC' },
          { text: 'Ruleset Spec',          link: '/RULESET-SPEC' },
          { text: 'Event Schema',          link: '/EVENT-SCHEMA' },
          { text: 'Matrix Integration',    link: '/MATRIX-INTEGRATION' },
          { text: 'Bridge Contract',       link: '/BRIDGE-CONTRACT' },
          { text: 'Bundle Policy',         link: '/BUNDLE-POLICY' },
          { text: 'Security Notes',        link: '/SECURITY-NOTES' },
        ],
      },
      {
        text: 'Authoring',
        items: [
          { text: 'Ruleset Tutorial', link: '/authoring/tutorial' },
        ],
      },
      {
        text: 'Contributing',
        items: [
          { text: 'Roadmap',           link: '/ROADMAP' },
          { text: 'Release Checklist', link: '/RELEASE-CHECKLIST' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ceearrbee/matrixvtt' },
    ],

    footer: {
      message: 'Released under the AGPL-3.0 License.',
      copyright: 'Copyright © MatrixVTT contributors',
    },

    search: { provider: 'local' },
  },
});
