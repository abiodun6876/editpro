export interface PresetSettings {
  id: string;
  name: string;
  category: 'Cinematic' | 'Nature' | 'Artistic' | 'Retouching' | 'Neural AI';
  filters: string; // CSS Filter string
  overlay?: {
    type: 'grain' | 'vignette' | 'volumetric' | 'neural-bokeh';
    intensity: number;
    color?: string;
  };
  aiSubjectOnly?: boolean;
  frequencySeparation?: {
    radius: number;
    intensity: number;
    toneSmoothing?: boolean;
  };
  tonalRange?: {
    whites: number;
    blacks: number;
    highlights: number;
    shadows: number;
    dehaze?: number;
  };
  toneCurve?: {
    highlights: number;
    lights: number;
    darks: number;
    shadows: number;
  };
  colorBalance?: {
    temp: number;
    tint: number;
  };
  glow?: {
    intensity: number;
    radius: number;
  };
  disabledSections?: Record<string, boolean>;
}
export interface ManualSettings {
  exposure: number;   // 0 to 2 (1 is default)
  contrast: number;   // 0 to 2 (1 is default)
  saturation: number; // 0 to 2 (1 is default)
  sharpness: number;  // 0 to 2 (0 is default)
  highlights: number; // 0 to 2 (1 is default)
  shadows: number;    // 0 to 2 (1 is default)
  whites: number;     // 0 to 2 (1 is default)
  blacks: number;     // 0 to 2 (1 is default)
  texture: number;    // -1 to 1 (0 is default, negative for skin softening)
  clarity: number;    // -1 to 1 (0 is default, negative for glow/softness)
  dehaze: number;     // -1 to 1 (0 is default)
  temp: number;       // -50 to 50 (0 is default, warmth)
  tint: number;       // -50 to 50 (0 is default, green/magenta)
  whiteOverlay: number; // 0 to 1 (high key wash)
  blackOverlay: number; // 0 to 1 (matte wash)
  disabledSections: Record<string, boolean>; // Section toggle state
  skinSoftening: number; // 0 to 1 (0 is default)
  // Photoshop Pro Tools
  brightness: number;     // 0 to 2 (1 is default)
  noiseReduction: number; // 0 to 1 (0 is default)
  hue: number;            // -180 to 180 (0 is default)
  levelsBlack: number;    // 0 to 100 (0 is default)
  levelsWhite: number;    // 155 to 255 (255 is default)
  tintShadows: string;    // #RRGGBB
  tintHighlights: string; // #RRGGBB
  autoBrush: number;      // 0 to 1 (0 is default)
  curves: number;         // -1 to 1 (0 is default)
  vibrance: number;       // 0 to 2 (1 is default)
  skinTone: number;       // 0 to 1 (0 is default)
  dodgeBurn: number;      // 0 to 1 (0 is default)
  // ACR 15 Details & Effects
  sharpenRadius: number;  // 0.5 to 3.0 (1.0 is default)
  sharpenDetail: number;  // 0 to 100 (25 is default)
  vignette: number;       // 0 to 1 (0 is default)
  grain: number;          // 0 to 1 (0 is default)
  // Watermark Feature
  watermarkText: string;
  watermarkOpacity: number;
  watermarkSize: number;
  watermarkColor: string;
}

export const presets: PresetSettings[] = [
  {
    id: 'neural-bokeh-pro',
    name: 'Neural Bokeh Pro',
    category: 'Neural AI',
    filters: 'brightness(1.05) saturate(1.1)',
    overlay: { type: 'neural-bokeh', intensity: 0.6 }
  },
  {
    id: 'atmospheric-ray-tracing',
    name: 'Atmospheric Ray-Tracing',
    category: 'Artistic',
    filters: 'brightness(1.1) contrast(1.1) saturate(1.2)',
    overlay: { type: 'volumetric', intensity: 0.4 }
  },
  {
    id: 'auto-retouch-pro',
    name: 'Auto-Retouch Pro',
    category: 'Retouching',
    filters: 'brightness(1.05) contrast(1.02) saturate(1.02)',
    frequencySeparation: { radius: 6, intensity: 0.85 },
    overlay: { type: 'vignette', intensity: 0.1 }
  },
  {
    id: 'skin-smooth-glow',
    name: 'Skin Smooth & Glow',
    category: 'Retouching',
    filters: 'brightness(1.08) contrast(0.95) saturate(1.05)',
    frequencySeparation: { radius: 12, intensity: 0.9 },
    overlay: { type: 'vignette', intensity: 0.05 }
  },
  {
    id: 'pro-portrait-polished',
    name: 'Pro Portrait Polished',
    category: 'Retouching',
    filters: 'brightness(1.1) contrast(1.05) saturate(1.05)',
    frequencySeparation: { radius: 8, intensity: 0.75 },
  },
  {
    id: 'mathematic-skin-sculpt',
    name: 'Mathematic Skin Sculpt',
    category: 'Retouching',
    filters: 'brightness(1.05) contrast(1.02)',
    frequencySeparation: { radius: 10, intensity: 0.8 }
  },
  {
    id: 'cinematic-gold',
    name: 'Cinematic Gold',
    category: 'Cinematic',
    filters: 'brightness(1.05) contrast(1.15) saturate(0.95) sepia(0.2) hue-rotate(-5deg)',
    overlay: { type: 'vignette', intensity: 0.1 }
  },
  {
    id: 'dark-moody-forest',
    name: 'Dark Moody Forest',
    category: 'Nature',
    filters: 'brightness(0.85) contrast(1.25) saturate(0.7) sepia(0.1) hue-rotate(10deg)',
    overlay: { type: 'vignette', intensity: 0.25 }
  },
  {
    id: 'bright-airy-wedding',
    name: 'Bright & Airy Wedding',
    category: 'Artistic',
    filters: 'brightness(1.2) contrast(0.9) saturate(1.1) sepia(0.05)',
  },
  {
    id: 'vibrant-city',
    name: 'Vibrant City',
    category: 'Cinematic',
    filters: 'brightness(1.02) contrast(1.3) saturate(1.35)',
  },
  {
    id: 'fine-art-bw',
    name: 'Fine Art B&W',
    category: 'Artistic',
    filters: 'grayscale(1) contrast(1.45) brightness(1.1)',
    overlay: { type: 'grain', intensity: 0.15 }
  },
  {
    id: 'vintage-film',
    name: 'Vintage Film',
    category: 'Artistic',
    filters: 'sepia(0.3) brightness(1.05) contrast(0.9) saturate(0.85) blur(0.2px)',
    overlay: { type: 'grain', intensity: 0.35 }
  },
  {
    id: 'warm-sunset',
    name: 'Warm Sunset',
    category: 'Nature',
    filters: 'sepia(0.4) saturate(1.4) brightness(1.1) contrast(1.1) hue-rotate(-10deg)',
  },
  {
    id: 'cool-arctic',
    name: 'Cool Arctic',
    category: 'Nature',
    filters: 'brightness(1.15) contrast(1.1) saturate(0.85) hue-rotate(180deg) sepia(0.1)',
  },
  {
    id: 'emerald-forest',
    name: 'Emerald Forest',
    category: 'Nature',
    filters: 'brightness(0.95) contrast(1.2) saturate(1.3) hue-rotate(20deg)',
  },
  {
    id: 'deep-blue-sea',
    name: 'Deep Blue Sea',
    category: 'Nature',
    filters: 'brightness(1) contrast(1.2) saturate(1.5) hue-rotate(190deg)',
  },
  {
    id: 'golden-hour-glow',
    name: 'Golden Hour Glow',
    category: 'Artistic',
    filters: 'sepia(0.5) saturate(1.5) brightness(1.15) contrast(1.05)',
  },
  {
    id: 'pastel-dream',
    name: 'Pastel Dream',
    category: 'Artistic',
    filters: 'brightness(1.3) contrast(0.8) saturate(1.1) sepia(0.1)',
  },
  {
    id: 'gritty-noir',
    name: 'Gritty Noir',
    category: 'Artistic',
    filters: 'grayscale(1) contrast(1.8) brightness(0.9)',
    overlay: { type: 'vignette', intensity: 0.4 }
  },
  {
    id: 'soft-portrait',
    name: 'Soft Portrait',
    category: 'Retouching',
    filters: 'brightness(1.1) contrast(0.95) saturate(1.05)',
    frequencySeparation: { radius: 15, intensity: 0.6 }
  },
  {
    id: 'night-life-glow',
    name: 'Night Life Glow',
    category: 'Cinematic',
    filters: 'brightness(1.2) contrast(1.4) saturate(1.5) hue-rotate(-20deg)',
  },
  {
    id: 'eye-detail-enhancer',
    name: 'Eye & Detail Enhancer',
    category: 'Retouching',
    filters: 'contrast(1.2) brightness(1.05)',
  },
  {
    id: 'fashion-high-end',
    name: 'Fashion High-End',
    category: 'Retouching',
    filters: 'contrast(1.4) brightness(1.1) saturate(1.2)',
    frequencySeparation: { radius: 4, intensity: 0.95 }
  },
  {
    id: 'soft-dreamy-skin',
    name: 'Soft Dreamy Skin',
    category: 'Retouching',
    filters: 'brightness(1.2) contrast(0.8) saturate(0.9)',
    frequencySeparation: { radius: 25, intensity: 1.0 }
  },
  {
    id: 'studio-master-pro',
    name: '👑 Studio Master Pro',
    category: 'Retouching',
    filters: 'brightness(1.05)',
    tonalRange: {
      whites: 1.12,
      blacks: 0.86,
      highlights: 0.62,
      shadows: 1.32,
      dehaze: -0.02
    },
    toneCurve: {
      highlights: 8,
      lights: 5,
      darks: -6,
      shadows: -10
    },
    colorBalance: {
      temp: 4,
      tint: 2
    },
    frequencySeparation: {
      radius: 8,
      intensity: 0.8,
      toneSmoothing: true
    },
    glow: {
      intensity: 0.25,
      radius: 25
    }
  },
  {
    id: 'pro-base',
    name: 'Pro Base (Exposure)',
    category: 'Cinematic',
    filters: 'brightness(1.02) contrast(1.02)',
    tonalRange: { whites: 1.05, blacks: 0.95, highlights: 0.9, shadows: 1.1 }
  },
  {
    id: 'pro-skin-polish',
    name: 'Pro Skin Polish',
    category: 'Retouching',
    filters: 'brightness(1.05)',
    frequencySeparation: { radius: 10, intensity: 0.7 },
  },
  {
    id: 'pro-glow-cinematic',
    name: 'Pro Glow Cinematic',
    category: 'Artistic',
    filters: 'brightness(1.1) saturate(1.1)',
    toneCurve: { shadows: -5, darks: -2, lights: 2, highlights: 5 },
    overlay: { type: 'volumetric', intensity: 0.2 }
  },
  {
    id: 'pro-sharpen-details',
    name: 'Pro Sharpen',
    category: 'Retouching',
    filters: 'contrast(1.05)',
  },
  {
    id: 'ultra-studio-pro',
    name: 'Ultra-Studio Pro',
    category: 'Retouching',
    filters: 'brightness(1.1) contrast(1.15) saturate(1.2)',
    frequencySeparation: { radius: 8, intensity: 0.85 },
    overlay: { type: 'vignette', intensity: 0.15 }
  }
];
