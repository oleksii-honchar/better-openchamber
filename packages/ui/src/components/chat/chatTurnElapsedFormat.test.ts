import { describe, expect, test } from 'bun:test';

import { dict as enDict } from '@/lib/i18n/messages/en';
import { dict as deDict } from '@/lib/i18n/messages/de';
import { dict as esDict } from '@/lib/i18n/messages/es';
import { dict as frDict } from '@/lib/i18n/messages/fr';
import { dict as jaDict } from '@/lib/i18n/messages/ja';
import { dict as koDict } from '@/lib/i18n/messages/ko';
import { dict as plDict } from '@/lib/i18n/messages/pl';
import { dict as ptBrDict } from '@/lib/i18n/messages/pt-BR';
import { dict as ukDict } from '@/lib/i18n/messages/uk';
import { dict as zhCnDict } from '@/lib/i18n/messages/zh-CN';
import { dict as zhTwDict } from '@/lib/i18n/messages/zh-TW';
import { formatMessage, type I18nKey, type I18nParams } from '@/lib/i18n';
// Type-only deep import (the barrel keeps its runtime surface narrow); tests
// in this package already import message modules directly.
import type { I18nDictionary } from '@/lib/i18n/store';

import { formatChatTurnElapsed } from './chatTurnElapsedFormat';

// The clock emoji is written as an escape so the expected bytes cannot drift
// through editor or tooling normalization.
const CLOCK = '\u{1F550}';
const RUNNING_KEY: I18nKey = 'chat.statusRow.runningFor';
const dictionaries = {
  en: enDict,
  de: deDict,
  es: esDict,
  fr: frDict,
  ja: jaDict,
  ko: koDict,
  pl: plDict,
  'pt-BR': ptBrDict,
  uk: ukDict,
  'zh-CN': zhCnDict,
  'zh-TW': zhTwDict,
} as const;

const translatorFor =
  (dictionary: I18nDictionary) =>
  (key: I18nKey, params?: I18nParams): string =>
    formatMessage(dictionary, key, params);

describe('formatChatTurnElapsed', () => {
  test('renders the running line through the English compact units', () => {
    const t = translatorFor(enDict);
    expect(formatChatTurnElapsed(47_000, t)).toBe(`${CLOCK} 47s`);
    expect(formatChatTurnElapsed(181_000, t)).toBe(`${CLOCK} 3m 1s`);
    expect(formatChatTurnElapsed(3_720_000, t)).toBe(`${CLOCK} 1h 2m`);
  });

  test('keeps the running-key value byte-identical in all eleven dictionaries', () => {
    // Emoji plus placeholder is locale-neutral: every dictionary ships the
    // same bytes, and nothing else. Driven from the message modules directly.
    for (const [locale, dictionary] of Object.entries(dictionaries)) {
      const value = (dictionary as Record<string, string>)[RUNNING_KEY];
      expect({ locale, value }).toEqual({ locale, value: `${CLOCK} {duration}` });
    }
  });

  test('renders German units from the German dictionary without English unit words', () => {
    const t = translatorFor(deDict);
    // The German dictionaries carry ASCII unit suffixes in
    // common.duration.* ({seconds}s, {minutes}m {seconds}s, {hours}h {minutes}m),
    // so the correct German render is the compact form itself — with no
    // English unit WORD, no 'Active for' copy, and no concatenated stray 's'.
    expect(formatChatTurnElapsed(47_000, t)).toBe(`${CLOCK} 47s`);
    expect(formatChatTurnElapsed(181_000, t)).toBe(`${CLOCK} 3m 1s`);
    for (const rendered of ['47s', '3m 1s'].map((suffix) => `${CLOCK} ${suffix}`)) {
      // Declared matcher surface only (this package's bun:test types do not
      // carry toMatch): boolean regex checks.
      expect(/\b(seconds|minutes|hours|active for)\b/i.test(rendered)).toBe(false);
      expect(/s{2,}|s\s+s/.test(rendered)).toBe(false);
    }

    // Prove the units are read from the provided dictionary rather than baked
    // into the composition: a sentinel in the German unit key must surface.
    const original = deDict['common.duration.secondsCompact'];
    try {
      deDict['common.duration.secondsCompact'] = 'Xq-{seconds}';
      expect(formatChatTurnElapsed(47_000, t)).toBe(`${CLOCK} Xq-47`);
    } finally {
      deDict['common.duration.secondsCompact'] = original;
    }
  });
});
