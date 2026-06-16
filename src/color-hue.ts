/* Color conversion and user color assignment helpers for ModernUI. */
const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
  const rgb = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!rgb) return { h: 0, s: 0, l: 0 };
  rgb.shift();
  const rgbNorm = rgb.map((c) => 1.0 * parseInt(c, 16) / 255);
  const max = Math.max(...rgbNorm);
  const min = Math.min(...rgbNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rgbNorm[0]: h = (rgbNorm[1] - rgbNorm[2]) / d + (rgbNorm[1] < rgbNorm[2] ? 6 : 0); break;
      case rgbNorm[1]: h = (rgbNorm[2] - rgbNorm[0]) / d + 2; break;
      case rgbNorm[2]: h = (rgbNorm[0] - rgbNorm[1]) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

const rgbtoHex = (r: number, g: number, b: number): string => {
  const rh = r.toString(16).padStart(2, '0');
  const gh = g.toString(16).padStart(2, '0');
  const bh = b.toString(16).padStart(2, '0');
  return `#${rh}${gh}${bh}`;
};

const hslToRGB = (h: number | string, s: number, l: number): [number, number, number] => {
  if (typeof h === 'string' && h.includes('deg')) h = parseInt(h.replace('deg', ''));
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + (h as number) / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
};

export async function setUserColors(): Promise<void> {
  const t0 = performance.now();
  const h = localStorage.getItem('sd-primary-h');
  const s = localStorage.getItem('sd-primary-s');
  const l = localStorage.getItem('sd-primary-l');
  const el = document.getElementById('sd-primary-color') as HTMLInputElement | null;
  if (!el) return;
  el.value = rgbtoHex(...hslToRGB(h ?? '0', Number(s ?? 0), Number(l ?? 0)));
  if (h) document.documentElement.style.setProperty('--sd-primary-h', h);
  if (s) document.documentElement.style.setProperty('--sd-primary-s', s);
  if (l) document.documentElement.style.setProperty('--sd-primary-l', l);
  el.onchange = (evt) => {
    const hsl = hexToHSL((evt.target as HTMLInputElement).value);
    log('setUserColors', hsl);
    document.documentElement.style.setProperty('--sd-primary-h', String(hsl.h));
    document.documentElement.style.setProperty('--sd-primary-s', String(hsl.s));
    document.documentElement.style.setProperty('--sd-primary-l', String(hsl.l));
    localStorage.setItem('sd-primary-h', String(hsl.h));
    localStorage.setItem('sd-primary-s', String(hsl.s));
    localStorage.setItem('sd-primary-l', String(hsl.l));
  };
  el.ondblclick = () => {
    localStorage.setItem('sd-primary-h', '180deg');
    localStorage.setItem('sd-primary-s', '60');
    localStorage.setItem('sd-primary-l', '40');
    setUserColors();
  };
  const t1 = performance.now();
  log('setUserColors', { h, s, l }, Math.round(t1 - t0));
  timer('setUserColors', t1 - t0);
}
