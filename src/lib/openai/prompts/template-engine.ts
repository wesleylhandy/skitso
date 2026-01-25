/**
 * Template Engine for Markdown Prompt Files
 * 
 * Reads markdown prompt files and performs simple variable substitution.
 * Uses {{variable}} syntax for placeholders.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Template variables can be strings, numbers, arrays, or objects
 */
type TemplateValue = string | number | boolean | string[] | object | null | undefined;

interface TemplateContext {
  [key: string]: TemplateValue;
}

/**
 * Extracts the System Prompt section from a markdown file
 * 
 * Looks for content between "## System Prompt" and the next "##" or "---"
 */
function extractSystemPrompt(markdown: string): string {
  const systemPromptMatch = markdown.match(/## System Prompt\s*\n\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (systemPromptMatch) {
    return systemPromptMatch[1].trim();
  }
  
  // Fallback: return everything after the first "---" separator
  const separatorMatch = markdown.match(/---\s*\n\n([\s\S]*)/);
  if (separatorMatch) {
    return separatorMatch[1].trim();
  }
  
  // Last resort: return the whole file
  return markdown.trim();
}

/**
 * Replaces template variables in a string
 * 
 * Supports:
 * - {{variable}} - simple replacement
 * - {{variable.property}} - object property access (not implemented, would need eval or custom parser)
 * - Arrays are JSON stringified
 * - Objects are JSON stringified
 */
function replaceVariables(template: string, context: TemplateContext): string {
  let result = template;
  
  // Find all {{variable}} placeholders
  const variableRegex = /\{\{(\w+)\}\}/g;
  const matches = Array.from(template.matchAll(variableRegex));
  
  for (const match of matches) {
    const fullMatch = match[0]; // e.g., "{{vibeContext}}"
    const variableName = match[1]; // e.g., "vibeContext"
    const value = context[variableName];
    
    let replacement = '';
    if (value === null || value === undefined) {
      // Remove the placeholder if value is missing
      replacement = '';
    } else if (typeof value === 'string') {
      replacement = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      replacement = String(value);
    } else if (Array.isArray(value)) {
      replacement = JSON.stringify(value);
    } else if (typeof value === 'object') {
      replacement = JSON.stringify(value);
    } else {
      replacement = String(value);
    }
    
    result = result.replace(fullMatch, replacement);
  }
  
  return result;
}

/**
 * Loads and processes a markdown prompt template
 * 
 * @param templatePath - Path to the markdown file relative to project root
 * @param context - Variables to substitute in the template
 * @returns Processed prompt string
 */
export function loadPromptTemplate(templatePath: string, context: TemplateContext): string {
  try {
    // In Next.js, we need to use process.cwd() for server-side file access
    const fullPath = join(process.cwd(), templatePath);
    const markdown = readFileSync(fullPath, 'utf-8');
    
    // Extract the System Prompt section
    const systemPrompt = extractSystemPrompt(markdown);
    
    // Replace variables
    const processed = replaceVariables(systemPrompt, context);
    
    return processed;
  } catch (error) {
    throw new Error(
      `Failed to load prompt template from ${templatePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Helper to format complex values for template insertion
 */
export function formatTemplateValue(value: TemplateValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}
