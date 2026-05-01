// SheSafe Design System
export const Colors = {
  primary: '#C0392B',
  primaryDark: '#922B21',
  primaryLight: '#E74C3C',
  safe: '#27AE60',
  safeDark: '#1E8449',
  warning: '#E67E22',
  warningLight: '#F39C12',
  danger: '#E74C3C',
  background: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceLight: '#2A2A2A',
  card: '#1E1E1E',
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textMuted: '#666666',
  border: '#333333',
  overlay: 'rgba(0,0,0,0.7)',
  white: '#FFFFFF',
  black: '#000000',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  giant: 48,
  mega: 72,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export function getRiskColor(score: number): string {
  if (score < 30) return Colors.safe;
  if (score < 60) return Colors.warningLight;
  if (score < 80) return Colors.warning;
  return Colors.danger;
}

export function getRiskLevel(score: number): string {
  if (score < 30) return "You're Safe";
  if (score < 60) return 'Stay Alert';
  if (score < 80) return 'High Risk';
  return 'DANGER';
}

export function getRiskLevelKey(score: number): 'safe' | 'watchful' | 'alert' | 'emergency' {
  if (score < 30) return 'safe';
  if (score < 60) return 'watchful';
  if (score < 80) return 'alert';
  return 'emergency';
}
