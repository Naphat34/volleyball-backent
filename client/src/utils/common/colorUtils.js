/**
 * Calculates the relative luminance of a color mixed with a parent background color.
 * Supports 3 or 6 digit hex colors.
 * 
 * @param {string} hexColor - The background color in Hex format (e.g. '#1d4ed8')
 * @param {number} alpha - The opacity of the hexColor (0 to 1)
 * @param {{r: number, g: number, b: number}} parentBg - The RGB of the background behind the color
 * @returns {string} - 'text-white' for dark backgrounds, 'text-slate-800' for light backgrounds
 */
export function getContrastClass(hexColor, alpha = 1, parentBg = { r: 255, g: 255, b: 255 }) {
    if (!hexColor || typeof hexColor !== 'string') return 'text-slate-800';
    
    let cleanHex = hexColor.trim().replace('#', '');
    if (cleanHex.length === 3) {
        cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
    }
    
    if (cleanHex.length !== 6) {
        return 'text-slate-800';
    }
    
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return 'text-slate-800';
    }
    
    // Mix background color with parent background based on alpha
    const rMixed = r * alpha + parentBg.r * (1 - alpha);
    const gMixed = g * alpha + parentBg.g * (1 - alpha);
    const bMixed = b * alpha + parentBg.b * (1 - alpha);
    
    // Standard relative luminance formula:
    // L = 0.2126 * R + 0.7152 * G + 0.0722 * B
    const toSRGB = (c) => {
        const val = c / 255;
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    };
    
    const L = 0.2126 * toSRGB(rMixed) + 0.7152 * toSRGB(gMixed) + 0.0722 * toSRGB(bMixed);
    
    // L threshold of 0.179 determines whether background is light or dark.
    // L > 0.179 => light background, use dark text.
    // L <= 0.179 => dark background, use light text.
    return L > 0.179 ? 'text-slate-800' : 'text-white';
}

/**
 * Similar to getContrastClass, but returns a Hex color code instead of a Tailwind class.
 * Useful for inline style overrides (e.g. style={{ color: getContrastColorHex(color) }})
 * 
 * @param {string} hexColor - The background color in Hex format
 * @param {number} alpha - The opacity of the hexColor (0 to 1)
 * @param {{r: number, g: number, b: number}} parentBg - The RGB of the background behind the color
 * @returns {string} - '#ffffff' for dark backgrounds, '#1e293b' for light backgrounds
 */
export function getContrastColorHex(hexColor, alpha = 1, parentBg = { r: 255, g: 255, b: 255 }) {
    const textClass = getContrastClass(hexColor, alpha, parentBg);
    return textClass === 'text-white' ? '#ffffff' : '#1e293b';
}

