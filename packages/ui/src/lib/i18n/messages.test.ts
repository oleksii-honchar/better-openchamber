import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { dict as enDict } from './messages/en';
import { dict as esDict } from './messages/es';
import { dict as deDict } from './messages/de';
import { dict as frDict } from './messages/fr';
import { dict as jaDict } from './messages/ja';
import { dict as koDict } from './messages/ko';
import { dict as plDict } from './messages/pl';
import { dict as ptBrDict } from './messages/pt-BR';
import { dict as ukDict } from './messages/uk';
import { dict as zhCnDict } from './messages/zh-CN';
import { dict as zhTwDict } from './messages/zh-TW';

const localeDictionaries = {
  en: enDict,
  de: deDict,
  fr: frDict,
  es: esDict,
  ja: jaDict,
  'pt-BR': ptBrDict,
  uk: ukDict,
  ko: koDict,
  pl: plDict,
  'zh-CN': zhCnDict,
  'zh-TW': zhTwDict,
} as const;

describe('i18n dictionaries', () => {
  test('all locales stay in key parity with english', () => {
    const englishKeys = Object.keys(enDict).sort();

    for (const dictionary of Object.values(localeDictionaries)) {
      expect(Object.keys(dictionary).sort()).toEqual(englishKeys);
    }
  });

  test('all locales expose language label keys', () => {
    for (const [, dictionary] of Object.entries(localeDictionaries)) {
      expect(dictionary['common.language.german']).toBeTruthy();
      expect(dictionary['common.language.french']).toBeTruthy();
      expect(dictionary['common.language.japanese']).toBeTruthy();
    }
  });

  test('every chat.media.* key exists in all locales with a real translation', () => {
    const mediaKeys = Object.keys(enDict).filter((key) => key.startsWith('chat.media.'));
    expect(mediaKeys.length).toBeGreaterThan(0);

    for (const [locale, dictionary] of Object.entries(localeDictionaries)) {
      for (const key of mediaKeys) {
        const value = dictionary[key as keyof typeof dictionary];
        expect(value).toBeTruthy();
        if (locale !== 'en') {
          expect(value).not.toBe(enDict[key as keyof typeof enDict]);
        }
      }
    }
  });
});

const mediaRenderFiles = [
  'src/components/chat/MarkdownImageGallery.tsx',
  'src/components/chat/markdownImageGalleryMedia.tsx',
  'src/components/chat/FileAttachment.tsx',
  'src/components/chat/filePartMedia.tsx',
] as const;

/**
 * Pre-existing English literals in the sweep scope, present before the
 * media feature (Tasks 5-10). Each entry is a file-path → literal occurrence.
 * Adding a NEW hardcoded English label to these files will fail the test.
 */
const preexistingEnglishLiteralsAllowlist: Readonly<Record<string, readonly string[]>> = {
  'src/components/chat/FileAttachment.tsx': [
    "'File attach failed'",
    "'Image'",
    "'Enter'",
    "'Unnamed file'",
    "'Image'",
    "'Image'",
    "'Image'",
  ],
};

/** Uppercase-English-sentence string literals: "'Media is unavailable'" / "'Image'". */
const englishLiteralPattern = /['"][A-Z][a-z]+(?: [a-z]+)+['"]|['"][A-Z][a-z]+['"]/g;

describe('chat media labels — hardcoded English sweep lock', () => {
  test('media render files contain no new hardcoded English labels', () => {
    for (const relativePath of mediaRenderFiles) {
      const source = readFileSync(
        join(__dirname, '..', '..', 'components', 'chat', basename(relativePath)),
        'utf-8',
      );
      const matches = source.match(englishLiteralPattern) ?? [];
      const newMatches = matches.filter(
        (match) => !preexistingEnglishLiteralsAllowlist[relativePath]?.includes(match),
      );
      expect(newMatches).toEqual([]);
    }
  });
});
