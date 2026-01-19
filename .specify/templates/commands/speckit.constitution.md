# Command: speckit.constitution

**Description:** Create or update the project constitution from interactive or provided principle inputs, ensuring all dependent templates stay in sync.

**Handoffs:**
- **Build Specification:** `speckit.specify` - "Implement the feature specification based on the updated constitution. I want to build..."

## Usage

This command updates the project constitution at `.specify/memory/constitution.md`. The constitution is a template containing placeholder tokens in square brackets (e.g. `[PROJECT_NAME]`, `[PRINCIPLE_1_NAME]`).

## Execution Flow

1. **Load Constitution:** Read `.specify/memory/constitution.md` and identify all placeholder tokens `[ALL_CAPS_IDENTIFIER]`.

2. **Collect Values:**
   - Use user input (conversation) if provided
   - Infer from existing repo context (README, docs, prior versions)
   - For dates: `RATIFICATION_DATE` (original adoption), `LAST_AMENDED_DATE` (today if changed)
   - Version increment follows semantic versioning:
     - **MAJOR:** Backward incompatible changes
     - **MINOR:** New principles/sections added
     - **PATCH:** Clarifications, typo fixes

3. **Draft Updated Constitution:**
   - Replace all placeholders with concrete text
   - Preserve heading hierarchy
   - Ensure principles are declarative and testable

4. **Consistency Propagation:**
   - Update `.specify/templates/plan-template.md` if needed
   - Update `.specify/templates/spec-template.md` if needed
   - Update `.specify/templates/tasks-template.md` if needed
   - Update command files in `.specify/templates/commands/*.md` if needed
   - Update runtime guidance docs (README.md, etc.) if needed

5. **Sync Impact Report:**
   - Prepend HTML comment at top of constitution
   - Include version change, modified principles, added/removed sections
   - List templates requiring updates (✅ updated / ⚠ pending)

6. **Validation:**
   - No unexplained bracket tokens
   - Version matches report
   - Dates in ISO format (YYYY-MM-DD)
   - Principles are declarative and testable

7. **Write Constitution:** Overwrite `.specify/memory/constitution.md`

8. **Output Summary:**
   - New version and bump rationale
   - Files flagged for manual follow-up
   - Suggested commit message

## Formatting Requirements

- Markdown headings exactly as in template
- Single blank line between sections
- No trailing whitespace
- Wrap long lines for readability (<100 chars ideally)

## Notes

- Do not create a new template; always operate on existing `.specify/memory/constitution.md`
- If critical info missing, insert `TODO(<FIELD_NAME>): explanation` and include in Sync Impact Report
