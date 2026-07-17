/**
 * Utility functions for filtering and validating players
 * Ensures consistent handling of player status across the application
 */

/**
 * Check if a player is marked as active (is_playing = 1 or true)
 * @param {Object} player - The player object to check
 * @returns {boolean} - True if player is active, false otherwise
 */
export const isPlayingPlayer = (p) => {
    if (!p) return false;

    const rawValue = p.is_playing ?? p.isPlaying;
    
    // If undefined/null/empty string, default to true (backward compatibility)
    if (rawValue === undefined || rawValue === null || rawValue === '') {
        return true;
    }

    // Handle boolean values
    if (typeof rawValue === 'boolean') return rawValue;
    
    // Handle numeric values (1 = true, 0 = false)
    if (typeof rawValue === 'number') return rawValue === 1;
    
    // Handle string values
    if (typeof rawValue === 'string') {
        const normalized = rawValue.trim().toLowerCase();
        return ['true', '1', 'yes', 'y', 'on'].includes(normalized);
    }

    return false;
};

/**
 * Check if a player is a Libero
 * @param {Object} player - The player object to check
 * @returns {boolean} - True if player is libero, false otherwise
 */
export const isPlayerLibero = (p) => {
    if (!p) return false;
    const role = String(p.role || '').toUpperCase();
    const pos = String(p.position || '').toUpperCase();
    return !!(
        p.isLibero ||
        p.is_libero ||
        p.is_libero1 ||
        p.is_libero2 ||
        role === 'L1' ||
        role === 'L2' ||
        role === 'L1+C' ||
        role === 'L2+C' ||
        role === 'L' ||
        pos === 'L' ||
        pos === 'L1' ||
        pos === 'L2'
    );
};

/**
 * Check if a player is a Captain
 * @param {Object} player - The player object to check
 * @returns {boolean} - True if player is captain, false otherwise
 */
export const isPlayerCaptain = (p) => {
    if (!p) return false;
    return !!(
        p.is_captain ||
        p.isCaptain ||
        p.role === 'C' ||
        p.role === 'L1+C' ||
        p.role === 'L2+C'
    );
};

/**
 * Filter active players from a roster
 * @param {Array} roster - Array of player objects
 * @returns {Array} - Filtered array of active players
 */
export const filterActivePlayers = (roster) => {
    if (!Array.isArray(roster)) return [];
    return roster.filter(isPlayingPlayer);
};

/**
 * Filter active non-Libero players from a roster
 * @param {Array} roster - Array of player objects
 * @returns {Array} - Filtered array of active non-Libero players
 */
export const filterActiveRegularPlayers = (roster) => {
    if (!Array.isArray(roster)) return [];
    return roster.filter(p => isPlayingPlayer(p) && !isPlayerLibero(p));
};

/**
 * Filter active Libero players from a roster
 * @param {Array} roster - Array of player objects
 * @returns {Array} - Filtered array of active Libero players
 */
export const filterActiveLiberos = (roster) => {
    if (!Array.isArray(roster)) return [];
    return roster.filter(p => isPlayingPlayer(p) && isPlayerLibero(p));
};

/**
 * Get player ID from different possible field names
 * @param {Object} player - The player object
 * @returns {*} - The player ID or null
 */
export const getPlayerId = (player) => {
    if (!player) return null;
    return player.id || player.player_id || player.playerId || null;
};

/**
 * Get player number from different possible field names
 * @param {Object} player - The player object
 * @returns {string|number} - The player number or '?'
 */
export const getPlayerNumber = (player) => {
    if (!player) return '?';
    return player.number || player.jersey_number || player.shirt_number || '?';
};
