/**
 * VibeContext Type Definitions
 * 
 * Defines the core types for the VibeContext system that controls
 * visual design, AI generation, and linguistic tone across the application.
 */

export type VibeType =
  | 'VIRAL_NEON'
  | 'INDIE_A24'
  | 'SITCOM_STUDIO'
  | 'BRAINROT_THEATER'
  | 'QUIET_STUDIO';

export type AnimationStyle = 'snappy' | 'smooth' | 'slow-fade' | 'bouncy' | 'instant';

export interface VisualTokens {
  bgColor: string;
  primaryColor: string;
  accentColor: string;
  textColor: string; // WCAG-compliant text color for bgColor
  headerFont: string;
  bodyFont: string;
  borderRadius: string;
  animationStyle: AnimationStyle;
  // Layout patterns
  cardStyle: {
    padding: string;
    gap: string;
    borderStyle: string;
    shadowStyle: string;
  };
  spacing: {
    section: string;
    component: string;
    element: string;
  };
}

export interface LinguisticTone {
  buttonLabels: Record<string, string>;
  placeholders: Record<string, string>;
  errorMessages: Record<string, string>;
  successMessages: Record<string, string>;
  sectionTitles: Record<string, string>;
}

export interface AIParameters {
  slangRegistry: string[];
  toneGuidelines: string;
  pacing: string;
  archetypeLabels: Record<string, string>;
}

export interface InteractionPatterns {
  animationSpeed: number;
  hoverEffects: string;
  clickFeedback: string;
  soundEffects: string[];
}

export interface LogoConfig {
  svg: string;
  typographyStyle: string;
  animations?: {
    glitch?: boolean;
    pulse?: boolean;
    scanlines?: boolean;
  };
}

export interface VibeContext {
  id: VibeType;
  visualTokens: VisualTokens;
  linguisticTone: LinguisticTone;
  aiParameters: AIParameters;
  interactionPatterns: InteractionPatterns;
  logo: LogoConfig;
}
