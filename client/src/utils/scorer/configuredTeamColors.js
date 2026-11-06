// Match-specific uniforms take precedence over the team defaults before first serve.
export function getConfiguredTeamColors(match) {
    return Object.fromEntries(['home', 'away'].flatMap(side =>
        ['team_color', 'libero_color'].map(key => [side + '_' + key, match[side + '_' + key]])
    ));
}

export function mergeConfiguredTeamColors(match, colors) {
    if (match.status !== 'scheduled' || match.first_serve_team_id) return colors;
    const result = { ...colors };
    for (const side of ['home', 'away']) {
        const color = match[side + '_team_color'];
        if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) result[side] = color;
    }
    return result;
}
