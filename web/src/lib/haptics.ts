import { getState } from './store';

export function buzz(pattern: number | number[]) {
  if (getState().settings.haptics && 'vibrate' in navigator) navigator.vibrate?.(pattern);
}
