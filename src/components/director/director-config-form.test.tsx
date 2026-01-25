/**
 * Tests for DirectorConfigForm Component
 * 
 * T071a: Test theme-specific layout patterns, section titles, and button labels
 * display correctly in Director's Desk
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { DirectorConfigForm } from './director-config-form';
import { vibeAtom } from '@/src/state/atoms/vibe-atom';
import { VIBE_CONFIGS } from '@/src/state/config/vibe-configs';
import type { VibeType } from '@/src/state/types/vibe';

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock PartyKit client (form calls updateCast, updateScript, updateSessionState, initializePartyKitClient, emitGenerationProgress)
vi.mock('@/src/lib/partykit/client', () => ({
  updateSessionState: vi.fn(),
  initializePartyKitClient: vi.fn(() => ({ readyState: 1, send: vi.fn() })),
  updateCast: vi.fn(),
  updateScript: vi.fn(),
  emitGenerationProgress: vi.fn(),
}));

describe('DirectorConfigForm - T071a: Theme-Specific Display', () => {
  const store = getDefaultStore();
  const ALL_VIBES: VibeType[] = [
    'VIRAL_NEON',
    'INDIE_A24',
    'SITCOM_STUDIO',
    'BRAINROT_THEATER',
    'QUIET_STUDIO',
  ];

  beforeEach(() => {
    localStorage.clear();
    store.set(vibeAtom, 'VIRAL_NEON');
    vi.clearAllMocks();
  });

  it('should display theme-specific section title for each vibe', async () => {
    for (const vibe of ALL_VIBES) {
      store.set(vibeAtom, vibe);
      const { unmount } = render(<DirectorConfigForm />);

      const config = VIBE_CONFIGS[vibe];
      const expectedTitle = config.linguisticTone.sectionTitles.configuration;

      await waitFor(() => {
        const heading = screen.getByRole('heading', { level: 2 });
        expect(heading).toHaveTextContent(expectedTitle);
      });

      unmount();
    }
  });

  it('should display theme-specific button labels', async () => {
    for (const vibe of ALL_VIBES) {
      store.set(vibeAtom, vibe);
      const { unmount } = render(<DirectorConfigForm />);

      const config = VIBE_CONFIGS[vibe];
      const expectedButtonLabel = config.linguisticTone.buttonLabels.submit;

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: new RegExp(expectedButtonLabel, 'i') });
        expect(submitButton).toBeInTheDocument();
      });

      unmount();
    }
  });

  it('should display theme-specific placeholder text', async () => {
    for (const vibe of ALL_VIBES) {
      store.set(vibeAtom, vibe);
      const { unmount } = render(<DirectorConfigForm />);

      const config = VIBE_CONFIGS[vibe];
      const expectedPlaceholder = config.linguisticTone.placeholders.theme;

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(expectedPlaceholder);
        expect(textarea).toBeInTheDocument();
      });

      unmount();
    }
  });

  it('should apply theme-specific visual tokens (card styles)', async () => {
    store.set(vibeAtom, 'VIRAL_NEON');
    const { container, unmount } = render(<DirectorConfigForm />);

    await waitFor(() => {
      const form = container.querySelector('.director-config-form');
      expect(form).toBeInTheDocument();
      
      // Check that inline styles are applied (visual tokens)
      const htmlElement = form as HTMLElement;
      expect(htmlElement).toBeDefined();
      // Check that style attribute exists (contains visual token values)
      const styleAttr = htmlElement.getAttribute('style');
      expect(styleAttr).toBeTruthy();
    });

    unmount();
  });

  it('should apply theme-specific spacing from visual tokens', async () => {
    for (const vibe of ALL_VIBES) {
      store.set(vibeAtom, vibe);
      const { container, unmount } = render(<DirectorConfigForm />);

      await waitFor(() => {
        const form = container.querySelector('.director-config-form');
        expect(form).toBeInTheDocument();
        // Visual tokens should be applied via inline styles
        const htmlElement = form as HTMLElement;
        const styleAttr = htmlElement.getAttribute('style');
        expect(styleAttr).toBeTruthy();
        // Should contain padding, gap, or border styles
        expect(styleAttr).toMatch(/padding|gap|border/i);
      });

      unmount();
    }
  });

  it('should use theme-specific fonts from visual tokens', async () => {
    for (const vibe of ALL_VIBES) {
      store.set(vibeAtom, vibe);
      const { container, unmount } = render(<DirectorConfigForm />);

      await waitFor(() => {
        const heading = container.querySelector('h2');
        expect(heading).toBeInTheDocument();
        // Font family should be set via inline style
        const htmlElement = heading as HTMLElement;
        const styleAttr = htmlElement.getAttribute('style');
        // Should have style attribute with font-family
        expect(styleAttr).toBeTruthy();
        expect(styleAttr).toMatch(/font-family/i);
      });

      unmount();
    }
  });

  it('should display different section titles for different vibes', async () => {
    const titles: Record<VibeType, string> = {
      VIRAL_NEON: 'The Vibe',
      INDIE_A24: 'Genre Selection',
      SITCOM_STUDIO: 'The Setup',
      BRAINROT_THEATER: 'THE CHAOS',
      QUIET_STUDIO: 'Configuration',
    };

    for (const [vibe, expectedTitle] of Object.entries(titles) as [VibeType, string][]) {
      store.set(vibeAtom, vibe);
      const { unmount } = render(<DirectorConfigForm />);

      await waitFor(() => {
        const heading = screen.getByRole('heading', { level: 2 });
        expect(heading).toHaveTextContent(expectedTitle);
      });

      unmount();
    }
  });

  it('should display different button labels for different vibes', async () => {
    const buttonLabels: Record<VibeType, string> = {
      VIRAL_NEON: 'Send It',
      INDIE_A24: 'Submit',
      SITCOM_STUDIO: "Let's Do This!",
      BRAINROT_THEATER: 'SEND IT!!!',
      QUIET_STUDIO: 'Submit',
    };

    for (const [vibe, expectedLabel] of Object.entries(buttonLabels) as [VibeType, string][]) {
      store.set(vibeAtom, vibe);
      const { unmount } = render(<DirectorConfigForm />);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: new RegExp(expectedLabel, 'i') });
        expect(button).toBeInTheDocument();
      });

      unmount();
    }
  });
});

describe('DirectorConfigForm - Optional Fields', () => {
  const store = getDefaultStore();

  beforeEach(() => {
    localStorage.clear();
    store.set(vibeAtom, 'VIRAL_NEON');
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        characters: [
          {
            name: 'Test Character',
            archetypeLabel: 'The Test',
            personalityTraits: ['Testy'],
            hiddenMotivation: 'To test',
            imagePrompt: 'A test character',
            attributes: [{ name: 'Test', rating: 50 }],
          },
        ],
      }),
    });
  });

  it('should render plot field', async () => {
    render(<DirectorConfigForm />);

    await waitFor(() => {
      const plotTextarea = screen.getByPlaceholderText(
        VIBE_CONFIGS.VIRAL_NEON.linguisticTone.placeholders.plot,
      );
      expect(plotTextarea).toBeInTheDocument();
    });

    const plotLabel = screen.getByLabelText(/deep lore/i);
    expect(plotLabel).toBeInTheDocument();
  });

  it('should render jokes field', async () => {
    render(<DirectorConfigForm />);

    await waitFor(() => {
      const jokesControl = screen.getByLabelText(/custom lines/i);
      expect(jokesControl).toBeInTheDocument();
    });

    const jokesTextarea = screen.getByPlaceholderText(
      VIBE_CONFIGS.VIRAL_NEON.linguisticTone.placeholders.jokes,
    );
    expect(jokesTextarea).toBeInTheDocument();
  });

  it('should render pre-defined characters section', async () => {
    render(<DirectorConfigForm />);

    await waitFor(() => {
      const charactersLabel = screen.getByText(/pre-defined characters/i);
      expect(charactersLabel).toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /add character/i });
    expect(addButton).toBeInTheDocument();
  });

  it('should allow adding and removing pre-defined characters', async () => {
    render(<DirectorConfigForm />);

    await waitFor(() => {
      const addButton = screen.getByRole('button', { name: /add character/i });
      expect(addButton).toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /add character/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText(/character name/i);
      expect(nameInput).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/character name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Character' } });

    const removeButton = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/character name/i)).not.toBeInTheDocument();
    });
  });

  it('should include plot in script generation request when provided', async () => {
    render(<DirectorConfigForm />);

    const themeInput = screen.getByPlaceholderText(VIBE_CONFIGS.VIRAL_NEON.linguisticTone.placeholders.theme);
    const plotInput = screen.getByPlaceholderText(
      VIBE_CONFIGS.VIRAL_NEON.linguisticTone.placeholders.plot,
    );
    await act(async () => {
      fireEvent.change(themeInput, { target: { value: 'A test theme for the skit' } });
      fireEvent.change(plotInput, { target: { value: 'A detailed plot description' } });
    });
    await waitFor(() => {
      expect(themeInput).toHaveValue('A test theme for the skit');
    });

    // Mock create session, then character + script generation
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            {
              name: 'Test Character',
              archetypeLabel: 'The Test',
              personalityTraits: ['Testy'],
              hiddenMotivation: 'To test',
              imagePrompt: 'A test character',
              attributes: [{ name: 'Test', rating: 50 }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          title: 'Test Script',
          length: '2 minutes',
          description: 'A test script',
          scenes: [],
        }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imageUrl: 'https://example.com/img.png' }),
      });

    const submitButton = screen.getByRole('button', { name: /send it/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Check that plot was included in script generation call
    const scriptCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => call[0] === '/api/openai/script'
    );

    if (scriptCall) {
      const requestBody = JSON.parse(scriptCall[1]?.body || '{}');
      expect(requestBody.plot).toBe('A detailed plot description');
    }
  });

  it('should include jokes in script generation request when provided', async () => {
    render(<DirectorConfigForm />);

    const themeInput = screen.getByPlaceholderText(VIBE_CONFIGS.VIRAL_NEON.linguisticTone.placeholders.theme);
    const jokesInput = screen.getByPlaceholderText(
      VIBE_CONFIGS.VIRAL_NEON.linguisticTone.placeholders.jokes,
    );
    await act(async () => {
      fireEvent.change(themeInput, { target: { value: 'A test theme for the skit' } });
      fireEvent.change(jokesInput, { target: { value: 'First joke\nSecond joke' } });
    });
    await waitFor(() => {
      expect(themeInput).toHaveValue('A test theme for the skit');
    });

    // Mock create session, then character + script generation, then update session + character image
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            {
              name: 'Test Character',
              archetypeLabel: 'The Test',
              personalityTraits: ['Testy'],
              hiddenMotivation: 'To test',
              imagePrompt: 'A test character',
              attributes: [{ name: 'Test', rating: 50 }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          title: 'Test Script',
          length: '2 minutes',
          description: 'A test script',
          scenes: [],
        }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imageUrl: 'https://example.com/img.png' }),
      });

    const submitButton = screen.getByRole('button', { name: /send it/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Check that jokes were included in script generation call
    const scriptCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => call[0] === '/api/openai/script'
    );

    if (scriptCall) {
      const requestBody = JSON.parse(scriptCall[1]?.body || '{}');
      expect(requestBody.jokes).toEqual(['First joke', 'Second joke']);
    }
  });

  it('should not include optional fields when empty', async () => {
    render(<DirectorConfigForm />);

    const themeInput = screen.getByPlaceholderText(VIBE_CONFIGS.VIRAL_NEON.linguisticTone.placeholders.theme);
    await act(async () => {
      fireEvent.change(themeInput, { target: { value: 'A test theme for the skit' } });
    });
    await waitFor(() => {
      expect(themeInput).toHaveValue('A test theme for the skit');
    });

    // Mock create session, then character + script, then update session + character image
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            {
              name: 'Test Character',
              archetypeLabel: 'The Test',
              personalityTraits: ['Testy'],
              hiddenMotivation: 'To test',
              imagePrompt: 'A test character',
              attributes: [{ name: 'Test', rating: 50 }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          title: 'Test Script',
          length: '2 minutes',
          description: 'A test script',
          scenes: [],
        }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imageUrl: 'https://example.com/img.png' }),
      });

    const submitButton = screen.getByRole('button', { name: /send it/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Check that optional fields are not included when empty
    const scriptCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => call[0] === '/api/openai/script'
    );

    if (scriptCall) {
      const requestBody = JSON.parse(scriptCall[1]?.body || '{}');
      expect(requestBody.plot).toBeUndefined();
      expect(requestBody.jokes).toBeUndefined();
    }
  });

  it('should include director-defined characters in character generation request when provided', async () => {
    render(<DirectorConfigForm />);

    // Fill required fields
    const themeInput = screen.getByPlaceholderText(VIBE_CONFIGS.VIRAL_NEON.linguisticTone.placeholders.theme);
    fireEvent.change(themeInput, { target: { value: 'A test theme for the skit' } });

    // Add a pre-defined character via the UI
    const addButton = await screen.findByRole('button', { name: /add character/i });
    fireEvent.click(addButton);

    const nameInput = await screen.findByPlaceholderText(/character name/i);
    fireEvent.change(nameInput, { target: { value: 'Director Predefined Character' } });

    const roleInput = await screen.findByPlaceholderText(/role \/ archetype/i);
    fireEvent.change(roleInput, { target: { value: 'Protagonist' } });

    // Mock create session, then character + script, then update session + character image
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            {
              name: 'Generated Character',
              archetypeLabel: 'The Generated',
              personalityTraits: ['Curious'],
              hiddenMotivation: 'To verify tests',
              imagePrompt: 'A generated character',
              attributes: [{ name: 'Charm', rating: 75 }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          title: 'Generated Script',
          length: '2 minutes',
          description: 'A generated script',
          scenes: [],
        }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imageUrl: 'https://example.com/img.png' }),
      });

    const submitButton = screen.getByRole('button', { name: /send it/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Verify director-defined characters were included in the character generation request
    const charactersCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => call[0] === '/api/openai/characters'
    );

    expect(charactersCall).toBeDefined();
    if (charactersCall) {
      const requestBody = JSON.parse((charactersCall[1] as RequestInit | undefined)?.body as string);
      expect(requestBody.directorDefinedCharacters).toBeDefined();
      expect(requestBody.directorDefinedCharacters).toHaveLength(1);
      expect(requestBody.directorDefinedCharacters[0]).toEqual(
        expect.objectContaining({
          name: 'Director Predefined Character',
          role: 'Protagonist',
        })
      );
    }
  });

  it('should include hiddenMotivation in character-image API request', async () => {
    render(<DirectorConfigForm />);

    const themeInput = screen.getByPlaceholderText(VIBE_CONFIGS.VIRAL_NEON.linguisticTone.placeholders.theme);
    await act(async () => {
      fireEvent.change(themeInput, { target: { value: 'A test theme for the skit' } });
    });
    await waitFor(() => {
      expect(themeInput).toHaveValue('A test theme for the skit');
    });

    // Mock create session, then character + script, then update session + character image
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          characters: [
            {
              name: 'Test Character',
              archetypeLabel: 'The Test',
              personalityTraits: ['Testy'],
              hiddenMotivation: 'To test hidden motivation inclusion',
              imagePrompt: 'A test character',
              attributes: [{ name: 'Test', rating: 50 }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          title: 'Test Script',
          length: '2 minutes',
          description: 'A test script',
          scenes: [],
        }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ imageUrl: 'https://example.com/img.png' }),
      });

    const submitButton = screen.getByRole('button', { name: /send it/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Verify hiddenMotivation is included in character-image API call
    const imageCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('/api/openai/character-image')
    );

    expect(imageCall).toBeDefined();
    if (imageCall) {
      const requestBody = JSON.parse((imageCall[1] as RequestInit | undefined)?.body as string);
      expect(requestBody.character).toBeDefined();
      expect(requestBody.character.hiddenMotivation).toBe('To test hidden motivation inclusion');
      expect(requestBody.character.name).toBe('Test Character');
      expect(requestBody.character.archetypeLabel).toBe('The Test');
      expect(requestBody.character.personalityTraits).toEqual(['Testy']);
      expect(requestBody.character.attributes).toEqual([{ name: 'Test', rating: 50 }]);
    }
  });
});
