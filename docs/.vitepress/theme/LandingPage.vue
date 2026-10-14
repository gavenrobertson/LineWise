<!-- SPDX-License-Identifier: Apache-2.0 -->
<!--
  The public download page (home of the docs site). It reads the newest published release from
  GitHub in the browser and offers the installer for the visitor's computer; until a release is
  published it says so and links to the releases page. Brand: spec section 15 (BRD-04, BRD-05).
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { withBase } from 'vitepress';
import shotDark from '../../img/screenshot-dark.png';
import shotLight from '../../img/screenshot-light.png';
import {
  detectPlatform,
  formatSize,
  installers,
  pickRelease,
  PLATFORM_LABEL,
  recommended,
  RELEASES_API,
  RELEASES_PAGE,
  versionOf,
  type GitHubRelease,
  type Installer,
  type InstallerKind,
  type Platform,
} from './releases.ts';

const REPO_URL = 'https://github.com/gavenrobertson/LineWise';

const status = ref<'loading' | 'ready' | 'none' | 'error'>('loading');
const release = ref<GitHubRelease | null>(null);
const beta = ref<GitHubRelease | null>(null);
const files = ref<Partial<Record<InstallerKind, Installer>>>({});
const platform = ref<Platform>('other');

// Sections rise in as they scroll into view. Without JavaScript, or under reduced motion, they are
// simply there: the hidden state applies only once `ready` is set.
const root = ref<HTMLElement | null>(null);
const ready = ref(false);
let observer: IntersectionObserver | null = null;
onMounted(() => {
  if (!root.value || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries)
        if (e.isIntersecting) {
          e.target.classList.add('shown');
          observer?.unobserve(e.target);
        }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  for (const el of root.value.querySelectorAll('.reveal')) observer.observe(el);
  ready.value = true;
});
onBeforeUnmount(() => observer?.disconnect());

onMounted(async () => {
  const nav = navigator as Navigator & {
    userAgentData?: {
      platform?: string;
      getHighEntropyValues?: (h: string[]) => Promise<{ architecture?: string }>;
    };
  };
  let arch = '';
  try {
    arch = (await nav.userAgentData?.getHighEntropyValues?.(['architecture']))?.architecture ?? '';
  } catch {
    // not offered by this browser
  }
  platform.value = detectPlatform(
    navigator.userAgent,
    nav.userAgentData?.platform ?? navigator.platform,
    arch,
  );
  try {
    const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(String(res.status));
    const picked = pickRelease((await res.json()) as GitHubRelease[]);
    release.value = picked.release;
    beta.value = picked.beta;
    files.value = picked.release ? installers(picked.release) : {};
    status.value = picked.release ? 'ready' : 'none';
  } catch {
    status.value = 'error';
  }
});

const version = computed(() => (release.value ? versionOf(release.value) : ''));
const isBeta = computed(() => !!release.value?.prerelease);
const published = computed(() =>
  release.value?.published_at
    ? new Date(release.value.published_at).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : '',
);
const primary = computed<Installer | null>(() => {
  const kind = recommended(platform.value);
  return (kind && files.value[kind]) || null;
});
const primaryLabel = computed(() => {
  if (status.value === 'none') return 'Follow on GitHub';
  return primary.value ? `Download for ${PLATFORM_LABEL[platform.value]}` : 'Download LineWise';
});
const primaryHref = computed(() => {
  if (status.value === 'none') return RELEASES_PAGE;
  return primary.value?.url ?? '#download';
});
const primaryMeta = computed(() => {
  if (status.value === 'loading') return 'Checking the latest release…';
  if (status.value === 'none') return 'The first public release is on its way';
  if (status.value === 'error') return 'Free for Windows and macOS';
  if (!primary.value) return `Version ${version.value} · Windows and macOS`;
  const ext = primary.value.name.split('.').pop();
  return `Version ${version.value} · ${formatSize(primary.value.size)} · .${ext}`;
});

const href = (kind: InstallerKind) => files.value[kind]?.url ?? (release.value?.html_url || RELEASES_PAGE);
const size = (kind: InstallerKind) => (files.value[kind] ? formatSize(files.value[kind]!.size) : '');
const cardFor = (p: Platform) =>
  p === 'windows-x64' || p === 'windows-arm64'
    ? 'windows'
    : p === 'macos'
      ? 'macos'
      : p === 'linux'
        ? 'linux'
        : '';
const yours = computed(() => cardFor(platform.value));
const available = computed(() => status.value === 'ready');

const features = [
  {
    title: 'Devices with real interfaces',
    link: '/user/devices',
    text: 'Connect Gi0/1 on a router to Gi1/0/24 on a switch, assign 10.0.12.1/30, and LineWise knows the link, the subnet and the VLANs.',
    icon: 'M4 7h16v10H4zM8 11h2M12 11h2M16 11h0',
  },
  {
    title: 'Three views, one model',
    link: '/user/views',
    text: 'Switch between the physical (L1), data link (L2) and network (L3) view of the same diagram, and highlight a VLAN or the path between two devices.',
    icon: 'M12 3 3 8l9 5 9-5zM3 13l9 5 9-5',
  },
  {
    title: 'Checks as you draw',
    link: '/user/validation',
    text: 'Duplicate IPs, subnet and native-VLAN mismatches, trunk and speed problems and more, each with a one-click fix where there is one.',
    icon: 'M9 12l2 2 4-4M12 3l8 4v5c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V7z',
  },
  {
    title: 'Import from Cisco CLI',
    link: '/user/import',
    text: 'Paste show cdp neighbors, show lldp neighbors or a running-config and review the result before it lands. Passwords and secrets are stripped.',
    icon: 'M4 17l6-5-6-5M12 19h8',
  },
  {
    title: 'Export to anything',
    link: '/user/export',
    text: 'PNG, SVG and PDF with a title block, CSV inventories and IP plans, HTML and Markdown reports, draw.io, Containerlab, Mermaid and DOT.',
    icon: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  },
  {
    title: 'Files you can diff',
    link: '/file-format',
    text: 'A .lwise file is stable, sorted, readable JSON with a published schema, so diagrams live happily in Git next to your configs.',
    icon: 'M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9',
  },
];

const promises = [
  { title: 'Free and open source', text: 'Apache-2.0. No account, no subscription.' },
  { title: 'Works offline', text: 'Everything runs on your computer.' },
  { title: 'No telemetry', text: 'Nothing about you or your diagrams leaves it.' },
  { title: 'One request, optional', text: 'An update check you can turn off.' },
];
</script>

<template>
  <div ref="root" class="lw-landing" :class="{ ready }">
    <!-- Hero -->
    <section class="hero" aria-labelledby="lw-hero-title">
      <div class="hero-inner">
        <img class="hero-mark" :src="withBase('/app-icon.svg')" alt="" width="72" height="72" />
        <p class="pill">
          <span class="dot" aria-hidden="true"></span>
          <template v-if="available">LineWise {{ version }} is out</template>
          <template v-else>Free and open source for Windows and macOS</template>
        </p>
        <h1 id="lw-hero-title">Network diagrams that <span class="accent neon">know the network.</span></h1>
        <p class="lede">
          Draw Cisco-style topologies where every icon is a real device with interfaces, IP addresses and
          VLANs. LineWise checks your design as you draw, works offline and is free.
        </p>
        <div class="cta">
          <a class="btn btn-primary" :href="primaryHref">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            </svg>
            {{ primaryLabel }}
          </a>
          <a class="btn btn-ghost" href="#download">All downloads</a>
        </div>
        <p class="meta" aria-live="polite">{{ primaryMeta }}</p>
      </div>
      <div class="shot">
        <div class="window">
          <div class="window-bar" aria-hidden="true"><span></span><span></span><span></span></div>
          <!-- The screenshot matches the site's theme. -->
          <img
            class="shot-dark"
            :src="shotDark"
            width="1600"
            height="1000"
            alt="LineWise showing a collapsed-core campus in the data link view, with the device library on the left and the inspector on the right"
          />
          <img
            class="shot-light"
            :src="shotLight"
            width="1600"
            height="1000"
            alt="LineWise showing a collapsed-core campus in the data link view, with the device library on the left and the inspector on the right"
          />
        </div>
      </div>
    </section>

    <!-- Downloads -->
    <section id="download" class="section" aria-labelledby="lw-download-title">
      <h2 id="lw-download-title" class="neon-title reveal">Download LineWise</h2>
      <p class="section-lede">
        <template v-if="available">
          <strong>{{ isBeta ? 'Beta' : 'Version' }} {{ version }}</strong>
          <span v-if="published"> · released {{ published }}</span> ·
          <a :href="release!.html_url">Release notes</a>
          <span v-if="beta">
            · <a :href="beta.html_url">Try beta {{ versionOf(beta) }}</a>
          </span>
        </template>
        <template v-else-if="status === 'none'">
          The first public release is being tested. Watch
          <a :href="REPO_URL">the repository</a> to hear when it is out, or build it from source today.
        </template>
        <template v-else-if="status === 'error'">
          Installers are on <a :href="RELEASES_PAGE">GitHub Releases</a>.
        </template>
        <template v-else>Checking the latest release…</template>
      </p>

      <div class="cards reveal">
        <article class="card" :class="{ yours: yours === 'windows' }" aria-labelledby="lw-win">
          <p v-if="yours === 'windows'" class="badge">Your system</p>
          <svg class="os" aria-hidden="true" viewBox="0 0 24 24" width="32" height="32">
            <rect x="3" y="4" width="18" height="13" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
          <h3 id="lw-win">Windows</h3>
          <p class="req">Windows 10 and 11</p>
          <a
            class="btn btn-solid primary-action"
            :class="{ disabled: !available }"
            :aria-disabled="!available"
            :href="href('windows-x64')"
          >
            {{ available ? 'Installer for x64' : 'Coming soon' }}
            <span class="size">{{ size('windows-x64') }}</span>
          </a>
          <ul class="alt">
            <li>
              <a :href="href('windows-arm64')">Windows on ARM (arm64)</a>
              <span class="size">{{ size('windows-arm64') }}</span>
            </li>
            <li>
              <a :href="href('windows-msi')">MSI for IT deployment</a>
              <span class="size">{{ size('windows-msi') }}</span>
            </li>
          </ul>
          <p class="note">Installs for your account, no admin rights needed.</p>
        </article>

        <article class="card" :class="{ yours: yours === 'macos' }" aria-labelledby="lw-mac">
          <p v-if="yours === 'macos'" class="badge">Your system</p>
          <svg class="os" aria-hidden="true" viewBox="0 0 24 24" width="32" height="32">
            <rect x="4" y="5" width="16" height="11" rx="1.5" />
            <path d="M2 19h20" />
          </svg>
          <h3 id="lw-mac">macOS</h3>
          <p class="req">macOS 12 or later</p>
          <a
            class="btn btn-solid primary-action"
            :class="{ disabled: !available }"
            :aria-disabled="!available"
            :href="href('macos')"
          >
            {{ available ? 'Disk image (.dmg)' : 'Coming soon' }}
            <span class="size">{{ size('macos') }}</span>
          </a>
          <ul class="alt">
            <li class="text">One universal app for Apple silicon and Intel Macs.</li>
          </ul>
          <p class="note">Drag LineWise into Applications.</p>
        </article>

        <article class="card" :class="{ yours: yours === 'linux' }" aria-labelledby="lw-linux">
          <p v-if="yours === 'linux'" class="badge">Your system</p>
          <svg class="os" aria-hidden="true" viewBox="0 0 24 24" width="32" height="32">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M7 9l3 3-3 3M12 15h5" />
          </svg>
          <h3 id="lw-linux">Linux</h3>
          <p class="req">Best effort · Ubuntu 22.04+, Fedora 39+</p>
          <a class="btn btn-outline primary-action" :href="`${REPO_URL}#build-from-source`"
            >Build from source</a
          >
          <ul class="alt">
            <li class="text">Needs Node.js 22, pnpm and Rust; then run <code>pnpm tauri build</code>.</li>
          </ul>
          <p class="note">No prebuilt packages yet.</p>
        </article>
      </div>

      <!-- First launch of an unsigned build -->
      <div class="firstrun reveal" aria-labelledby="lw-firstrun">
        <h3 id="lw-firstrun">Opening LineWise the first time</h3>
        <p>
          LineWise isn't code-signed yet, so Windows and macOS ask you to confirm the first time you open it.
          Your files never leave your computer, and every download has a published checksum.
          <a :href="withBase('/user/install')">Why does my computer warn me?</a>
        </p>
        <div class="steps">
          <div>
            <h4>Windows</h4>
            <ol>
              <li>Run the installer.</li>
              <li>
                If SmartScreen says <em>Windows protected your PC</em>, choose <strong>More info</strong>,
                then <strong>Run anyway</strong>.
              </li>
            </ol>
          </div>
          <div>
            <h4>macOS</h4>
            <ol>
              <li>Open the disk image and drag LineWise into <strong>Applications</strong>.</li>
              <li>
                Open LineWise. If macOS says it can't check it, open
                <strong>System Settings → Privacy &amp; Security</strong> and choose
                <strong>Open Anyway</strong>.
              </li>
            </ol>
          </div>
          <div>
            <h4>Check the download</h4>
            <p>Compare the hash with <code>SHA256SUMS.txt</code> on the release page.</p>
            <p class="cmd-label">Windows</p>
            <pre><code>certutil -hashfile &lt;file&gt; SHA256</code></pre>
            <p class="cmd-label">macOS</p>
            <pre><code>shasum -a 256 &lt;file&gt;</code></pre>
          </div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section class="section alt-bg" aria-labelledby="lw-features">
      <h2 id="lw-features" class="neon-title reveal">Diagrams that understand what they show</h2>
      <p class="section-lede reveal">
        Not just boxes and lines: LineWise models the network, so it can check it and export it.
      </p>
      <div class="features reveal">
        <a v-for="f in features" :key="f.title" class="feature" :href="withBase(f.link)">
          <span class="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24"><path :d="f.icon" /></svg>
          </span>
          <h3>{{ f.title }}</h3>
          <p>{{ f.text }}</p>
          <span class="more">Learn more <span class="arrow" aria-hidden="true">→</span></span>
        </a>
      </div>
    </section>

    <!-- Promises -->
    <section class="section" aria-labelledby="lw-private">
      <h2 id="lw-private" class="neon-title reveal">Private by default</h2>
      <ul class="promises reveal">
        <li v-for="p in promises" :key="p.title">
          <strong>{{ p.title }}</strong>
          <span>{{ p.text }}</span>
        </li>
      </ul>
    </section>

    <!-- Closing call to action -->
    <section class="closing" aria-labelledby="lw-closing">
      <h2 id="lw-closing" class="neon-title">Ready to draw your <span class="neon">network?</span></h2>
      <div class="cta">
        <a class="btn btn-primary" :href="primaryHref">{{ primaryLabel }}</a>
        <a class="btn btn-ghost" :href="withBase('/user/getting-started')">Read the guide</a>
      </div>
      <p class="fineprint">
        LineWise works with Cisco IOS, IOS-XE and NX-OS command output. It is not affiliated with or endorsed
        by Cisco or any other vendor.
      </p>
    </section>
  </div>
</template>

<style scoped>
/* Palette. Light theme first; the dark theme (the default) is Ink with Link teal (BRD-05). */
.lw-landing {
  --ink: #0e1726;
  --teal: #0d9488;
  --teal-bright: #2dd4bf;
  --teal-text: #0f766e;
  --glow: 45, 212, 191;
  --ease: cubic-bezier(0.2, 0, 0, 1);
  --ease-pop: cubic-bezier(0.3, 0, 0, 1.25);

  --hero-bg: #f4f6f8;
  --hero-text: #0e1726;
  --hero-muted: #4b5563;
  --hero-line: #d5dbe3;
  --hero-raised: #ffffff;
  --hero-dot: rgba(14, 23, 38, 0.08);
  --hero-glow: rgba(13, 148, 136, 0.18);
  --accent-from: #0f766e;
  --accent-to: #0d9488;
  --neon-strength: 0.35;
  --primary-bg: #0f766e;
  --primary-hover: #115e59;
  --primary-text: #ffffff;
}
.dark .lw-landing {
  --hero-bg: #0e1726;
  --hero-text: #ffffff;
  --hero-muted: #a3aebf;
  --hero-line: #2c3a52;
  --hero-raised: #1a2436;
  --hero-dot: rgba(255, 255, 255, 0.07);
  --hero-glow: rgba(13, 148, 136, 0.38);
  --accent-from: #2dd4bf;
  --accent-to: #5eead4;
  --neon-strength: 1;
  --primary-bg: #2dd4bf;
  --primary-hover: #5eead4;
  --primary-text: #0e1726;
}

/* ------------------------------------------------------------------ neon titles
   A soft teal glow around the glyphs: strong on Ink, a gentle halo on the light theme. It breathes
   slowly unless motion is reduced. `drop-shadow` follows the painted gradient text. */
.neon {
  filter: drop-shadow(0 0 6px rgba(var(--glow), calc(0.55 * var(--neon-strength))))
    drop-shadow(0 0 18px rgba(var(--glow), calc(0.4 * var(--neon-strength))));
  animation: neon-breathe 4.5s ease-in-out infinite;
}
@keyframes neon-breathe {
  50% {
    filter: drop-shadow(0 0 8px rgba(var(--glow), calc(0.75 * var(--neon-strength))))
      drop-shadow(0 0 28px rgba(var(--glow), calc(0.55 * var(--neon-strength))));
  }
}
.dark .neon-title {
  text-shadow:
    0 0 10px rgba(var(--glow), 0.35),
    0 0 32px rgba(var(--glow), 0.25),
    0 0 64px rgba(13, 148, 136, 0.2);
}
/* A glowing bar under section titles. */
.section h2.neon-title::after {
  content: '';
  display: block;
  width: 64px;
  height: 3px;
  margin: 16px auto 0;
  border-radius: 3px;
  background: linear-gradient(90deg, transparent, var(--teal-bright), transparent);
  box-shadow: 0 0 12px rgba(var(--glow), calc(0.8 * var(--neon-strength)));
}

/* ------------------------------------------------------------------ hero */
.hero {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(60rem 30rem at 50% -10%, var(--hero-glow), transparent 70%),
    radial-gradient(circle at 1px 1px, var(--hero-dot) 1px, transparent 0) 0 0 / 24px 24px,
    var(--hero-bg);
  color: var(--hero-text);
  padding: 72px 24px 0;
  transition:
    background-color 0.3s var(--ease),
    color 0.3s var(--ease);
}
.hero-inner {
  max-width: 820px;
  margin: 0 auto;
  text-align: center;
}
.hero-mark {
  margin: 0 auto 20px;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(13, 148, 136, 0.35);
  animation: float 6s ease-in-out infinite;
}
@keyframes float {
  50% {
    transform: translateY(-6px);
    box-shadow: 0 18px 48px rgba(var(--glow), 0.45);
  }
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 20px;
  padding: 6px 14px;
  border: 1px solid var(--hero-line);
  border-radius: 999px;
  background: color-mix(in srgb, var(--hero-raised) 70%, transparent);
  font-size: 14px;
  color: var(--hero-muted);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--teal-bright);
  box-shadow: 0 0 0 4px rgba(var(--glow), 0.18);
  animation: ping 2.4s var(--ease) infinite;
}
@keyframes ping {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--glow), 0.55);
  }
  70%,
  100% {
    box-shadow: 0 0 0 9px rgba(var(--glow), 0);
  }
}
.hero h1 {
  margin: 0;
  font-size: clamp(2.4rem, 6vw, 4.25rem);
  line-height: 1.05;
  letter-spacing: -0.035em;
  font-weight: 700;
  color: var(--hero-text);
  border: 0;
}
.accent {
  background: linear-gradient(90deg, var(--accent-from), var(--accent-to), var(--accent-from));
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation:
    neon-breathe 4.5s ease-in-out infinite,
    shimmer 8s linear infinite;
}
@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}
.lede {
  margin: 20px auto 0;
  max-width: 640px;
  font-size: 1.15rem;
  line-height: 1.6;
  color: var(--hero-muted);
}
.cta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 32px;
}
.meta {
  margin: 14px 0 0;
  font-size: 14px;
  color: var(--hero-muted);
}

/* ------------------------------------------------------------------ buttons
   Hover lifts and brightens, the glow grows; pressing sinks; a light sweep crosses the primary. */
.btn {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0 22px;
  height: 48px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  text-decoration: none !important;
  transition:
    transform 0.2s var(--ease-pop),
    background-color 0.2s var(--ease),
    border-color 0.2s var(--ease),
    box-shadow 0.25s var(--ease),
    color 0.2s var(--ease);
}
.btn svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.25s var(--ease-pop);
}
.btn:hover {
  transform: translateY(-2px);
}
.btn:hover svg {
  transform: translateY(2px);
}
.btn:active {
  transform: translateY(0) scale(0.98);
  transition-duration: 0.08s;
}
.btn:focus-visible {
  outline: 3px solid var(--teal-bright);
  outline-offset: 3px;
}
.btn-primary {
  background: var(--primary-bg);
  color: var(--primary-text) !important;
  box-shadow: 0 8px 30px rgba(var(--glow), calc(0.3 * var(--neon-strength) + 0.15));
}
.btn-primary::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, 0.45) 50%, transparent 70%);
  transform: translateX(-120%);
  transition: transform 0.6s var(--ease);
  pointer-events: none;
}
.btn-primary:hover {
  background: var(--primary-hover);
  box-shadow:
    0 12px 36px rgba(var(--glow), calc(0.35 * var(--neon-strength) + 0.2)),
    0 0 0 4px rgba(var(--glow), 0.18);
}
.btn-primary:hover::after {
  transform: translateX(120%);
}
.btn-ghost {
  border: 1px solid var(--hero-line);
  background: color-mix(in srgb, var(--hero-raised) 60%, transparent);
  color: var(--hero-text) !important;
}
.btn-ghost:hover {
  border-color: var(--teal);
  background: var(--hero-raised);
  box-shadow:
    0 0 0 4px rgba(var(--glow), 0.12),
    0 0 22px rgba(var(--glow), calc(0.25 * var(--neon-strength)));
}

/* ------------------------------------------------------------------ screenshot */
.shot {
  max-width: 1120px;
  margin: 56px auto 0;
}
.window {
  border: 1px solid var(--hero-line);
  border-bottom: 0;
  border-radius: 14px 14px 0 0;
  overflow: hidden;
  background: var(--hero-raised);
  box-shadow:
    0 -10px 80px rgba(13, 148, 136, 0.25),
    0 30px 80px rgba(0, 0, 0, 0.35);
  transition:
    transform 0.5s var(--ease),
    box-shadow 0.5s var(--ease);
}
.window:hover {
  transform: translateY(-4px);
  box-shadow:
    0 -14px 100px rgba(var(--glow), 0.38),
    0 30px 80px rgba(0, 0, 0, 0.4);
}
.window-bar {
  display: flex;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--hero-line);
}
.window-bar span {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--hero-line);
}
.window img {
  display: block;
  width: 100%;
  height: auto;
}
.shot-light {
  display: none !important;
}
html:not(.dark) .shot-dark {
  display: none !important;
}
html:not(.dark) .shot-light {
  display: block !important;
}

/* ------------------------------------------------------------------ sections */
.section {
  max-width: 1120px;
  margin: 0 auto;
  padding: 88px 24px;
  text-align: center;
}
.alt-bg {
  max-width: none;
  background: var(--vp-c-bg-soft);
}
.alt-bg > * {
  max-width: 1072px;
  margin-left: auto;
  margin-right: auto;
}
.section h2,
.closing h2 {
  margin: 0;
  font-weight: 700;
  border: 0;
  padding: 0;
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  letter-spacing: -0.025em;
  line-height: 1.15;
}
.section-lede {
  margin: 14px auto 0;
  max-width: 640px;
  color: var(--vp-c-text-2);
  font-size: 1.05rem;
}
/* Text links: an underline that fills in from the left. */
.section-lede a,
.firstrun > p a,
.alt a {
  color: var(--vp-c-brand-1);
  text-decoration: none;
  background: linear-gradient(currentColor, currentColor) 0 100% / 0 1.5px no-repeat;
  transition:
    background-size 0.3s var(--ease),
    color 0.2s var(--ease);
}
.section-lede a,
.firstrun > p a {
  background-size: 100% 1px;
}
.section-lede a:hover,
.firstrun > p a:hover,
.alt a:hover {
  background-size: 100% 1.5px;
  color: var(--vp-c-brand-2);
}

/* Scroll reveal, only once the page has run (`ready`) and motion is allowed. */
.ready .reveal {
  opacity: 0;
  transform: translateY(18px);
  transition:
    opacity 0.6s var(--ease),
    transform 0.6s var(--ease);
}
.ready .reveal.shown {
  opacity: 1;
  transform: none;
}

/* ------------------------------------------------------------------ download cards
   The whole card is the main button's target (the button's ::before covers it); the other links
   sit above it. */
.cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  margin-top: 44px;
  text-align: left;
}
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 28px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  background: var(--vp-c-bg-soft);
  transition:
    transform 0.3s var(--ease-pop),
    border-color 0.25s var(--ease),
    box-shadow 0.3s var(--ease);
}
.card:has(.primary-action:hover),
.card:hover {
  transform: translateY(-4px);
  border-color: var(--vp-c-brand-3);
  box-shadow:
    0 0 0 1px var(--vp-c-brand-3),
    0 16px 40px rgba(var(--glow), calc(0.12 + 0.18 * var(--neon-strength)));
}
.card.yours {
  border-color: var(--vp-c-brand-3);
  box-shadow: 0 0 0 4px var(--vp-c-brand-soft);
}
.primary-action {
  position: static !important;
}
.primary-action::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: 18px;
}
.card .alt,
.card .alt a,
.card .badge {
  position: relative;
  z-index: 2;
}
.badge {
  position: absolute !important;
  top: 18px;
  right: 18px;
  margin: 0;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-2);
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 0 14px rgba(var(--glow), calc(0.35 * var(--neon-strength)));
}
.os {
  fill: none;
  stroke: var(--vp-c-brand-1);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition:
    transform 0.35s var(--ease-pop),
    filter 0.3s var(--ease);
}
.card:hover .os {
  transform: scale(1.12) rotate(-4deg);
  filter: drop-shadow(0 0 6px rgba(var(--glow), 0.6));
}
.card h3 {
  margin: 14px 0 2px;
  font-size: 1.35rem;
}
.req {
  margin: 0 0 20px;
  color: var(--vp-c-text-2);
  font-size: 14px;
}
.btn-solid {
  justify-content: space-between;
  background: var(--teal-text);
  color: #fff !important;
}
.card:hover .btn-solid {
  background: #115e59;
  box-shadow: 0 8px 22px rgba(var(--glow), 0.3);
}
.btn-outline {
  justify-content: center;
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1) !important;
}
.card:hover .btn-outline {
  border-color: var(--vp-c-brand-3);
  color: var(--vp-c-brand-1) !important;
}
.card:hover .btn {
  transform: none;
}
.btn.disabled {
  opacity: 0.55;
}
.size {
  font-weight: 500;
  font-size: 13px;
}
.alt {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
  font-size: 14px;
  color: var(--vp-c-text-2);
}
.alt li.text {
  display: block;
}
.alt li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  padding: 8px 0;
  border-top: 1px solid var(--vp-c-divider);
}
.alt a {
  font-weight: 500;
}
.note {
  margin: auto 0 0;
  padding-top: 16px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.firstrun {
  margin-top: 40px;
  padding: 28px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  text-align: left;
}
.firstrun h3 {
  margin: 0;
  font-size: 1.2rem;
}
.firstrun > p {
  margin: 8px 0 0;
  max-width: 760px;
  color: var(--vp-c-text-2);
}
.steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px;
  margin-top: 20px;
}
.steps h4 {
  margin: 0 0 6px;
  font-size: 1rem;
}
.steps ol {
  margin: 0;
  padding-left: 1.2em;
  list-style: decimal;
  font-size: 14px;
  color: var(--vp-c-text-2);
}
.steps li {
  margin: 4px 0;
}
.steps p {
  margin: 0;
  font-size: 14px;
  color: var(--vp-c-text-2);
}
.cmd-label {
  margin-top: 10px !important;
  font-weight: 600;
}
.steps pre {
  margin: 4px 0 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--vp-c-bg-alt);
  font-size: 12px;
  overflow-x: auto;
}

/* ------------------------------------------------------------------ features (links to the guide) */
.features {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  margin-top: 44px;
  text-align: left;
}
.feature {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  background: var(--vp-c-bg);
  color: inherit !important;
  text-decoration: none !important;
  cursor: pointer;
  transition:
    transform 0.3s var(--ease-pop),
    border-color 0.25s var(--ease),
    box-shadow 0.3s var(--ease);
}
.feature:hover {
  transform: translateY(-4px);
  border-color: var(--vp-c-brand-3);
  box-shadow:
    0 0 0 1px var(--vp-c-brand-3),
    0 16px 40px rgba(var(--glow), calc(0.12 + 0.18 * var(--neon-strength)));
}
.feature:focus-visible {
  outline: 3px solid var(--teal-bright);
  outline-offset: 3px;
}
.feature-icon {
  display: inline-grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--vp-c-brand-soft);
  transition:
    transform 0.35s var(--ease-pop),
    box-shadow 0.3s var(--ease);
}
.feature-icon svg {
  fill: none;
  stroke: var(--vp-c-brand-1);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.feature:hover .feature-icon {
  transform: scale(1.1) rotate(-6deg);
  box-shadow: 0 0 22px rgba(var(--glow), calc(0.2 + 0.35 * var(--neon-strength)));
}
.feature h3 {
  margin: 14px 0 6px;
  font-size: 1.05rem;
  transition: color 0.2s var(--ease);
}
.feature:hover h3 {
  color: var(--vp-c-brand-1);
}
.feature p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}
.more {
  margin-top: auto;
  padding-top: 14px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}
.arrow {
  display: inline-block;
  transition: transform 0.3s var(--ease-pop);
}
.feature:hover .arrow {
  transform: translateX(5px);
}

/* ------------------------------------------------------------------ promises (statements, not links) */
.promises {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  list-style: none;
  margin: 36px 0 0;
  padding: 0;
}
.promises li {
  margin: 0;
  padding: 20px;
  border-radius: 14px;
  border-top: 2px solid var(--vp-c-brand-3);
  background: var(--vp-c-bg-soft);
  text-align: left;
}
.promises strong {
  display: block;
  font-size: 1rem;
}
.promises span {
  font-size: 14px;
  color: var(--vp-c-text-2);
}

/* ------------------------------------------------------------------ closing */
.closing {
  padding: 88px 24px 72px;
  text-align: center;
  background:
    radial-gradient(40rem 20rem at 50% 120%, var(--hero-glow), transparent 70%),
    radial-gradient(circle at 1px 1px, var(--hero-dot) 1px, transparent 0) 0 0 / 24px 24px,
    var(--hero-bg);
  color: var(--hero-text);
}
.closing h2 {
  color: var(--hero-text);
}
.closing .neon {
  background: linear-gradient(90deg, var(--accent-from), var(--accent-to));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.fineprint {
  max-width: 640px;
  margin: 28px auto 0;
  font-size: 13px;
  color: var(--hero-muted);
}

@media (max-width: 960px) {
  .cards,
  .features,
  .steps {
    grid-template-columns: minmax(0, 1fr);
  }
  .card.yours {
    order: -1;
  }
  .promises {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 520px) {
  .promises {
    grid-template-columns: minmax(0, 1fr);
  }
  .hero {
    padding-top: 48px;
  }
  .btn {
    width: 100%;
    justify-content: center;
  }
}
/* Reduced motion: no lifts, sweeps, breathing, floating or reveals; colors still change. */
@media (prefers-reduced-motion: reduce) {
  .neon,
  .accent,
  .hero-mark,
  .dot {
    animation: none;
  }
  .btn,
  .btn svg,
  .card,
  .os,
  .feature,
  .feature-icon,
  .arrow,
  .window,
  .btn-primary::after {
    transition-property: color, background-color, border-color, box-shadow;
  }
  .btn:hover,
  .btn:hover svg,
  .btn:active,
  .card:hover,
  .card:has(.primary-action:hover),
  .card:hover .os,
  .feature:hover,
  .feature:hover .feature-icon,
  .feature:hover .arrow,
  .window:hover {
    transform: none;
  }
  .btn-primary::after {
    display: none;
  }
}
</style>
