// SPDX-License-Identifier: Apache-2.0
/** The "?" help popover for a topic (FR-UX-10), with "Learn more" opening the user guide page. */
import { DOCS_URL } from '../lib/actions.ts';
import { helpTopic, type HelpId } from '../lib/help.ts';
import { platform } from '../platform/index.ts';
import { HelpPopover } from './ui.tsx';

export function HelpButton({ topic }: { topic: HelpId }) {
  const h = helpTopic(topic);
  return (
    <HelpPopover
      title={h.title}
      what={h.what}
      why={h.why}
      example={h.example}
      onLearnMore={() => void platform().openExternal(`${DOCS_URL}${h.doc}`)}
    />
  );
}
