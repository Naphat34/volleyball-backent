const selected = person => Number(person.selected) === 1;
const unique = people => [...new Map(people.map((person, index) => [String(person.id ?? `row-${index}`), person])).values()];

// Entry membership and role flags are authoritative, including explicit zeroes.
export function compositionPlayers(competition, roster, players = []) {
  if (competition.team_entry_id) {
    if (!Array.isArray(roster?.players)) return [];
    return unique(roster.players.filter(selected)).map(player => {
      const role = player.entry_role == null ? null : String(player.entry_role).trim().toUpperCase();
      const position = role?.startsWith('L') ? 'L' : ['S', 'OH', 'MB', 'OP', 'OPP'].includes(role) ? role : player.position;
      return {
        ...player, position,
        number: player.entry_number ?? player.number,
        is_captain: player.entry_is_captain ?? (role != null ? role.includes('C') : player.is_captain),
        is_libero1: player.entry_is_libero1 ?? (role != null ? role === 'L' || role.startsWith('L1') : player.is_libero1),
        is_libero2: player.entry_is_libero2 ?? (role != null ? role.startsWith('L2') : player.is_libero2),
        is_playing: player.entry_is_playing ?? player.is_playing,
      };
    });
  }
  const normalize = gender => ['female', 'women', 'w', 'f', 'หญิง'].includes(String(gender).toLowerCase()) ? 'Female' : ['male', 'men', 'm', 'ชาย'].includes(String(gender).toLowerCase()) ? 'Male' : '';
  const gender = normalize(competition.entry_gender || competition.competition_gender || competition.gender);
  return unique(players.filter(player => !gender || normalize(player.gender) === gender));
}

export function compositionStaff(competition, roster, staff = []) {
  if (competition.team_entry_id) return Array.isArray(roster?.staff) ? unique(roster.staff.filter(selected)) : [];
  return unique(staff);
}

export const compositionRosterReady = (competition, roster) => !competition.team_entry_id || (Array.isArray(roster?.players) && Array.isArray(roster?.staff));
