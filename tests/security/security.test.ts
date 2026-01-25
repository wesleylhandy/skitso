import { describe, it, expect } from 'vitest';
import {
  sanitizePlainText,
  escapeForHtml,
  sanitizeIdentifier,
  deepSanitizeObject,
} from '@/src/lib/security/input-sanitizer';

describe('T199: Security sanitization utilities', () => {
  it('sanitizes plain text by stripping tags and collapsing whitespace', () => {
    expect(sanitizePlainText('  <b>Hello</b>   world ')).toBe('Hello world');
  });

  it('escapes dangerous HTML characters', () => {
    expect(escapeForHtml(`<script>alert("x")</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });

  it('sanitizes identifiers by removing special characters', () => {
    expect(sanitizeIdentifier('Hello, World! #1')).toBe('Hello World 1');
  });

  it('deeply sanitizes objects', () => {
    const input = {
      name: '<b>Alice</b>',
      nested: {
        comment: 'Hi   there   ',
      },
      list: [' <i>one</i> ', { value: ' two ' }],
    };

    const result = deepSanitizeObject(input);
    expect(result.name).toBe('Alice');
    expect((result.nested as { comment: string }).comment).toBe('Hi there');
  });
}
);

