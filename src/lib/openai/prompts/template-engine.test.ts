import { describe, it, expect } from 'vitest';
import { formatTemplateValue } from './template-engine';

// Note: loadPromptTemplate tests require file system access and are better tested
// through integration tests. The core string replacement logic is tested here
// via formatTemplateValue, and the file reading is straightforward Node.js fs usage.

describe('formatTemplateValue', () => {
  it('should format strings', () => {
    expect(formatTemplateValue('hello')).toBe('hello');
  });

  it('should format numbers', () => {
    expect(formatTemplateValue(42)).toBe('42');
    expect(formatTemplateValue(0)).toBe('0');
    expect(formatTemplateValue(-5)).toBe('-5');
  });

  it('should format booleans', () => {
    expect(formatTemplateValue(true)).toBe('true');
    expect(formatTemplateValue(false)).toBe('false');
  });

  it('should format arrays', () => {
    expect(formatTemplateValue(['a', 'b'])).toBe('[\n  "a",\n  "b"\n]');
    expect(formatTemplateValue([1, 2, 3])).toBe('[\n  1,\n  2,\n  3\n]');
  });

  it('should format objects', () => {
    expect(formatTemplateValue({ key: 'value' })).toBe('{\n  "key": "value"\n}');
    expect(formatTemplateValue({ key: 'value', number: 42 })).toContain('"key": "value"');
    expect(formatTemplateValue({ key: 'value', number: 42 })).toContain('"number": 42');
  });

  it('should handle null/undefined', () => {
    expect(formatTemplateValue(null)).toBe('');
    expect(formatTemplateValue(undefined)).toBe('');
  });

  it('should handle nested objects', () => {
    const nested = { outer: { inner: 'value' } };
    const result = formatTemplateValue(nested);
    expect(result).toContain('"outer"');
    expect(result).toContain('"inner"');
  });
});

describe('formatTemplateValue', () => {
  it('should format strings', () => {
    expect(formatTemplateValue('hello')).toBe('hello');
  });

  it('should format numbers', () => {
    expect(formatTemplateValue(42)).toBe('42');
  });

  it('should format arrays', () => {
    expect(formatTemplateValue(['a', 'b'])).toBe('[\n  "a",\n  "b"\n]');
  });

  it('should format objects', () => {
    expect(formatTemplateValue({ key: 'value' })).toBe('{\n  "key": "value"\n}');
  });

  it('should handle null/undefined', () => {
    expect(formatTemplateValue(null)).toBe('');
    expect(formatTemplateValue(undefined)).toBe('');
  });
});
