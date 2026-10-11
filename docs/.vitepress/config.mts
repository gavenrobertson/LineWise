// SPDX-License-Identifier: Apache-2.0
// The LineWise documentation site (DOC-01, DOC-02), published to GitHub Pages by docs.yml.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';
import { docsDirOf, EXCLUDED, REPO, repoLinks } from './repoLinks.ts';

const docsDir = docsDirOf(fileURLToPath(new URL('.', import.meta.url)));
const base = '/linewise/';

export const guide = [
  { text: 'Overview', link: '/user/' },
  { text: 'Getting started', link: '/user/getting-started' },
  { text: 'Drawing basics', link: '/user/drawing' },
  { text: 'Devices and interfaces', link: '/user/devices' },
  { text: 'Links', link: '/user/links' },
  { text: 'VLANs and IPAM', link: '/user/vlans-ipam' },
  { text: 'Views', link: '/user/views' },
  { text: 'Validation', link: '/user/validation' },
  { text: 'Importing from Cisco CLI', link: '/user/import' },
  { text: 'Exporting', link: '/user/export' },
  { text: 'Keyboard shortcuts', link: '/user/shortcuts' },
  { text: 'FAQ', link: '/user/faq' },
];

export const developer = [
  { text: 'Developer guide', link: '/dev/' },
  { text: 'Architecture', link: '/dev/architecture' },
  { text: 'Releases, signing and updates', link: '/dev/release' },
  { text: 'Release checklist', link: '/release-checklist' },
  { text: 'File format', link: '/file-format' },
  { text: 'Brand', link: '/brand' },
  { text: 'Decisions log', link: '/decisions-log' },
  {
    text: 'Architecture decisions',
    items: [
      { text: '0001 Tauri over Electron', link: '/adr/0001-tauri-over-electron' },
      { text: '0002 React Flow over maxGraph', link: '/adr/0002-react-flow-over-maxgraph' },
      { text: '0003 Commands and patches', link: '/adr/0003-command-patch-architecture' },
      { text: '0004 File format', link: '/adr/0004-file-format' },
      { text: '0005 License', link: '/adr/0005-license' },
    ],
  },
];

export default withMermaid(
  defineConfig({
    title: 'LineWise',
    description: 'Open-source, offline network diagrams where every icon is a real device.',
    lang: 'en-US',
    base,
    cleanUrls: true,
    lastUpdated: true,
    srcExclude: EXCLUDED,
    head: [['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }]],
    markdown: { config: (md) => repoLinks(md, docsDir) },
    themeConfig: {
      logo: { src: '/logo-mark.svg', alt: '' },
      nav: [
        { text: 'Guide', link: '/user/getting-started', activeMatch: '/user/' },
        { text: 'Developers', link: '/dev/', activeMatch: '/(dev|adr)/' },
        { text: 'Download', link: `${REPO}/releases/latest` },
      ],
      sidebar: {
        '/user/': [{ text: 'User guide', items: guide }],
        '/': [{ text: 'Developers', items: developer }],
      },
      socialLinks: [{ icon: 'github', link: REPO }],
      search: { provider: 'local' },
      editLink: { pattern: `${REPO}/edit/main/docs/:path`, text: 'Edit this page on GitHub' },
      footer: {
        message: 'Released under the Apache-2.0 license.',
        copyright: '© 2026 LineWise contributors',
      },
    },
  }),
);
