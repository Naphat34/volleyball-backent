const rgb = hex => {
    const value = /^#[\da-f]{6}$/i.test(hex || '') ? hex.slice(1) : '397fff';
    return [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16));
};
const hex = values => '#' + values.map(value => Math.round(value).toString(16).padStart(2, '0')).join('');
const mix = (color, base, amount) => color.map((value, index) => value * (1 - amount) + base[index] * amount);
const luminance = color => rgb(color).map(value => {
    const channel = value / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);

export function contrastRatio(foreground, background) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + .05) / (values[1] + .05);
}

function readableColor(color, background, dark) {
    const base = dark ? [255, 255, 255] : [0, 0, 0];
    for (let step = 0; step <= 20; step++) {
        const candidate = hex(mix(rgb(color), base, step / 20));
        if (contrastRatio(candidate, background) >= 4.5) return candidate;
    }
    return dark ? '#ffffff' : '#000000';
}

export function visTeamPalette(color, theme) {
    const dark = theme === 'dark';
    const surface = dark ? '#172231' : '#ffffff';
    const card = hex(mix(rgb(color), rgb(surface), .84));
    return { ink: readableColor(color, surface, dark), card, cardInk: readableColor(color, card, dark) };
}
