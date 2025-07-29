const hexToHSL = (hex) => {
  let rgb = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  rgb.shift();
  rgb = rgb.map((c) => 1.0 * parseInt(c, 16) / 255);
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rgb[0]: h = (rgb[1] - rgb[2]) / d + (rgb[1] < rgb[2] ? 6 : 0); break;
      case rgb[1]: h = (rgb[2] - rgb[0]) / d + 2; break;
      case rgb[2]: h = (rgb[0] - rgb[1]) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

const rgbtoHex = (r, g, b) => {
  r = r.toString(16).padStart(2, '0');
  g = g.toString(16).padStart(2, '0');
  b = b.toString(16).padStart(2, '0');
  const hex = `#${r}${g}${b}`;
  return hex;
};

const hslToRGB = (h, s, l) => {
  if (typeof h === 'string' && h.includes('deg')) h = parseInt(h.replace('deg', ''));
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const rgb = [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
  return rgb;
};

async function setUserColors() {
  const h = localStorage.getItem('sd-primary-h');
  const s = localStorage.getItem('sd-primary-s');
  const l = localStorage.getItem('sd-primary-l');
  log('setUserColors', h, s, l);
  const el = document.getElementById('sd-primary-color');
  el.value = rgbtoHex(...hslToRGB(h, s, l));
  if (h) document.documentElement.style.setProperty('--sd-primary-h', h);
  if (s) document.documentElement.style.setProperty('--sd-primary-s', s);
  if (l) document.documentElement.style.setProperty('--sd-primary-l', l);
  el.onchange = (evt) => {
    const hsl = hexToHSL(evt.target.value);
    log('setUserColors', hsl);
    document.documentElement.style.setProperty('--sd-primary-h', hsl.h);
    document.documentElement.style.setProperty('--sd-primary-s', hsl.s);
    document.documentElement.style.setProperty('--sd-primary-l', hsl.l);
    localStorage.setItem('sd-primary-h', hsl.h);
    localStorage.setItem('sd-primary-s', hsl.s);
    localStorage.setItem('sd-primary-l', hsl.l);
  };
  el.ondblclick = () => {
    localStorage.setItem('sd-primary-h', '180deg');
    localStorage.setItem('sd-primary-s', '60');
    localStorage.setItem('sd-primary-l', '40');
    setUserColors();
  };
}
