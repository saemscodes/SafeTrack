/**
 * SafeTrack — Local Boring Avatars Engine
 * Implements the full deterministic "Beam" variant logic locally.
 * Zero external calls. Zero-exposure identity generation.
 */

const AvatarEngine = (() => {
  const SIZE = 36;
  const DEFAULT_COLORS = ["#0B0C10", "#02B9FC", "#7C3AED", "#F59E0B", "#EF4444"];

  const hashCode = (name) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        const character = name.charCodeAt(i);
        hash = ((hash << 5) - hash) + character;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };

  const getModulus = (num, max) => num % max;

  const getDigit = (number, ntn) => Math.floor((number / Math.pow(10, ntn)) % 10);

  const getBoolean = (number, ntn) => (!(getDigit(number, ntn) % 2));

  const getUnit = (number, range, index) => {
    const value = number % range;
    if (index && ((getDigit(number, index) % 2) === 0)) {
        return -value;
    } else return value;
  };

  const getRandomColor = (number, colors, range) => colors[number % range];

  const getContrast = (hex) => {
    let h = hex.startsWith('#') ? hex.slice(1) : hex;
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#0B0C10' : '#FFFFFF';
  };

  function generateData(name, colors) {
    const numFromName = hashCode(name);
    const range = colors.length;
    const wrapperColor = getRandomColor(numFromName, colors, range);
    const preTranslateX = getUnit(numFromName, 10, 1);
    const wrapperTranslateX = preTranslateX < 5 ? preTranslateX + SIZE / 9 : preTranslateX;
    const preTranslateY = getUnit(numFromName, 10, 2);
    const wrapperTranslateY = preTranslateY < 5 ? preTranslateY + SIZE / 9 : preTranslateY;

    return {
      wrapperColor: wrapperColor,
      faceColor: getContrast(wrapperColor),
      backgroundColor: getRandomColor(numFromName + 13, colors, range),
      wrapperTranslateX: wrapperTranslateX,
      wrapperTranslateY: wrapperTranslateY,
      wrapperRotate: getUnit(numFromName, 360),
      wrapperScale: 1 + getUnit(numFromName, SIZE / 12) / 10,
      isMouthOpen: getBoolean(numFromName, 2),
      isCircle: getBoolean(numFromName, 1),
      eyeSpread: getUnit(numFromName, 5),
      mouthSpread: getUnit(numFromName, 3),
      faceRotate: getUnit(numFromName, 10, 3),
      faceTranslateX: wrapperTranslateX > SIZE / 6 ? wrapperTranslateX / 2 : getUnit(numFromName, 8, 1),
      faceTranslateY: wrapperTranslateY > SIZE / 6 ? wrapperTranslateY / 2 : getUnit(numFromName, 7, 2),
    };
  }

  return {
    generateSVG(name, colors = DEFAULT_COLORS, size = 120, square = false) {
      const data = generateData(name, colors);
      const rx = square ? 0 : (data.isCircle ? SIZE : SIZE / 6);
      
      const mouth = data.isMouthOpen 
        ? `<path d="M15 ${19 + data.mouthSpread}c2 1 4 1 6 0" stroke="${data.faceColor}" fill="none" stroke-linecap="round" />`
        : `<path d="M13,${19 + data.mouthSpread} a1,0.75 0 0,0 10,0" fill="${data.faceColor}" />`;

      return `
        <svg viewBox="0 0 ${SIZE} ${SIZE}" fill="none" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
          <mask id="mask_beam" maskUnits="userSpaceOnUse" x="0" y="0" width="${SIZE}" height="${SIZE}">
            <rect width="${SIZE}" height="${SIZE}" rx="${square ? 0 : SIZE * 2}" fill="#FFFFFF" />
          </mask>
          <g mask="url(#mask_beam)">
            <rect width="${SIZE}" height="${SIZE}" fill="${data.backgroundColor}" />
            <rect x="0" y="0" width="${SIZE}" height="${SIZE}" 
                  transform="translate(${data.wrapperTranslateX} ${data.wrapperTranslateY}) rotate(${data.wrapperRotate} ${SIZE/2} ${SIZE/2}) scale(${data.wrapperScale})" 
                  fill="${data.wrapperColor}" rx="${rx}" />
            <g transform="translate(${data.faceTranslateX} ${data.faceTranslateY}) rotate(${data.faceRotate} ${SIZE/2} ${SIZE/2})">
              ${mouth}
              <rect x="${14 - data.eyeSpread}" y="14" width="1.5" height="2" rx="1" stroke="none" fill="${data.faceColor}" />
              <rect x="${20 + data.eyeSpread}" y="14" width="1.5" height="2" rx="1" stroke="none" fill="${data.faceColor}" />
            </g>
          </g>
        </svg>
      `.trim();
    }
  };
})();

window.AvatarEngine = AvatarEngine;
