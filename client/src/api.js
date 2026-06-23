import axios from 'axios';

//const BASE_URL = `${import.meta.env.VITE_API_URL}/api`;

const BASE_URL = `http://localhost:3000/api`;


// สร้าง instance ของ axios
const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // ✅ สำคัญ! บอกให้ Axios ส่ง/รับ Cookies อัตโนมัติ
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


export const api = {
  // Auth
  login: (credentials) => apiClient.post('/auth/login', credentials),
  register: (data) => apiClient.post('/auth/register', data),
  logout: () => apiClient.post('/auth/logout'),

  // Admin
  getPendingUsers: () => apiClient.get('/admin/pending-users'),
  approveUser: (userId, status) => apiClient.post('/admin/approve', { userId, status }),

  // Team
  createMyTeam: (data) => apiClient.post('/my-team/create', data),
  getMyTeam: () => apiClient.get('/my-team'),
  updateMyTeam: (data) => apiClient.put('/my-team', data),
  getMyMatches: () => apiClient.get('/my-team/matches'),

  // ข้อมูลเดิม (ถ้ามี)
  getPlayers: () => apiClient.get('/players'),

  // Player Management
  getMyPlayers: () => apiClient.get('/my-team/players'),
  addPlayer: (data) => apiClient.post('/my-team/players', data),
  updatePlayer: (id, data) => apiClient.put(`/my-team/players/${id}`, data),
  deletePlayer: (id) => apiClient.delete(`/my-team/players/${id}`),
  getMyPlayersStats: () => apiClient.get('/my-team/players/stats'),
  getPlayerStats: (id) => apiClient.get(`/players/${id}/stats`),
  getPlayersByTeam: (teamId) => apiClient.get(`/public/teams/${teamId}/players`),
  getStaffByTeam: (teamId) => apiClient.get(`/public/teams/${teamId}/staff`),

  // Staff Management
  getMyStaff: () => apiClient.get('/my-team/staff'),
  addStaff: (data) => apiClient.post('/my-team/staff', data),
  updateStaff: (id, data) => apiClient.put(`/my-team/staff/${id}`, data),
  deleteStaff: (id) => apiClient.delete(`/my-team/staff/${id}`),

  // === Admin Management ===
  getAllUsers: () => apiClient.get('/admin/users'),
  createUser: (data) => apiClient.post('/admin/users', data),
  updateUser: (id, data) => apiClient.put(`/admin/users/${id}`, data),
  deleteUser: (id) => apiClient.delete(`/admin/users/${id}`),

  getAllTeams: () => apiClient.get('/admin/teams'),
  createTeam: (data) => apiClient.post('/admin/teams', data),
  updateTeam: (id, data) => apiClient.put(`/admin/teams/${id}`, data),
  deleteTeam: (id) => apiClient.delete(`/admin/teams/${id}`),

  // --- Competitions  ---
  getAllCompetitions: () => apiClient.get('/admin/competitions'),
  createCompetition: (data) => apiClient.post('/admin/competitions', data),
  updateCompetition: (id, data) => apiClient.put(`/admin/competitions/${id}`, data),
  deleteCompetition: (id) => apiClient.delete(`/admin/competitions/${id}`),
  updateCompetitionStatus: (id, status) => apiClient.patch(`/admin/competitions/${id}/status`, { status }),

  getOpenCompetitions: () => apiClient.get('/competitions/open'),
  getMyCompetitions: () => apiClient.get('/my-team/competitions'),
  getPublicCompetitionMatches: (id) => apiClient.get(`/public/competitions/${id}/matches`),
  getPublicCompetitionTeams: (id) => apiClient.get(`/public/competitions/${id}/teams`),
  getPublicTeamsList: () => apiClient.get('/public/teams'),
  getPublicMatches: () => apiClient.get('/public/matches'),
  joinCompetition: (competition_id) => apiClient.post('/competitions/join', { competition_id }),
  leaveCompetition: (competition_id) => apiClient.post('/competitions/leave', { competition_id }),

  // --- Age Groups ---
  getAllAgeGroups: () => apiClient.get('/age-groups'),
  // --- Categories ---
  getAllCategories: () => apiClient.get('/categories'),

  saveCoinToss: (matchId, data) => apiClient.post(`/scorer/match/${matchId}/toss`, data),

  // --- Stadiums Management ---
  getStadiums: () => apiClient.get('/admin/stadiums'),
  createStadium: (data) => apiClient.post('/admin/stadiums', data),
  updateStadium: (id, data) => apiClient.put(`/admin/stadiums/${id}`, data),
  deleteStadium: (id) => apiClient.delete(`/admin/stadiums/${id}`),

  // --- Match APIs (Admin) ---
  createMatch: (data) => apiClient.post('/matches', data),
  getTeamsByCompetition: (compId) => apiClient.get(`/admin/competitions/${compId}/teams`),
  removeTeamFromCompetition: (compId, teamId) => apiClient.delete(`/admin/competitions/${compId}/teams/${teamId}`),
  getMatchesByCompetition: (competitionId) => apiClient.get(`/competitions/${competitionId}/matches`),
  getAllMatches: () => apiClient.get('/admin/matches/all'),
  deleteMatch: (id) => apiClient.delete(`/matches/${id}`),
  updateMatch: (id, data) => apiClient.put(`/matches/${id}`, data),

  getTeamDetails: (id) => apiClient.get(`/admin/teams/${id}`),
  getAllPlayers: () => apiClient.get('/admin/players'),

  // Admin Player Management
  addPlayerAdmin: (teamId, data) => apiClient.post(`/admin/teams/${teamId}/players`, data),
  updatePlayerAdmin: (id, data) => apiClient.put(`/admin/players/${id}`, data),
  deletePlayerAdmin: (id) => apiClient.delete(`/admin/players/${id}`),

  // --- ✅ Scorer System (ส่วนที่เพิ่มใหม่) ---
  // ใช้ route /scorer/match/... ตามที่ตั้งค่าไว้ใน backend
  getMatchById: (id) => apiClient.get(`/scorer/match/${id}`),
  saveLineup: (matchId, data) => apiClient.post(`/scorer/match/${matchId}/lineup`, data),
  getMatchLineup: (matchId) => apiClient.get(`/scorer/match/${matchId}/lineup`,),
  saveMatchEvent: (matchId, data) => apiClient.post(`/scorer/match/${matchId}/event`, data),
  getMatchEvents: (matchId) => apiClient.get(`/scorer/match/${matchId}/events`),
  updateLiveState: (matchId, state) => apiClient.put(`/scorer/match/${matchId}/state`, { state }),
  getLiveState: (matchId) => apiClient.get(`/scorer/match/${matchId}/state`),
  getMatchLineups: (matchId) => apiClient.get(`/scorer/match/${matchId}/lineup`),

  // --- Officials (Referees/Scorers/LineJudges) ---
  getAllReferees: () => apiClient.get('/admin/referees'),
  createReferee: (data) => apiClient.post('/admin/referees', data),
  updateReferee: (id, data) => apiClient.put(`/admin/referees/${id}`, data),
  deleteReferee: (id) => apiClient.delete(`/admin/referees/${id}`),

  getAllScorers: () => apiClient.get('/admin/scorers'),
  createScorer: (data) => apiClient.post('/admin/scorers', data),
  updateScorer: (id, data) => apiClient.put(`/admin/scorers/${id}`, data),
  deleteScorer: (id) => apiClient.delete(`/admin/scorers/${id}`),

  getAllLineJudges: () => apiClient.get('/admin/line-judges'),
  createLineJudge: (data) => apiClient.post('/admin/line-judges', data),
  updateLineJudge: (id, data) => apiClient.put(`/admin/line-judges/${id}`, data),
  deleteLineJudge: (id) => apiClient.delete(`/admin/line-judges/${id}`),

  // อัปเดตข้อมูลเจ้าหน้าที่ในแมตช์
  updateMatchOfficials: (matchId, data) => apiClient.put(`/scorer/match/${matchId}/officials`, data),
  endSet: (matchId, data) => apiClient.post(`/scorer/match/${matchId}/end-set`, data),
  startSet: (matchId, data) => apiClient.post(`/scorer/match/${matchId}/start-set`, data),
  getMatchScoresheetData: (matchId) => apiClient.get(`/scorer/match/${matchId}/scoresheet`),
  getMatchRosterData: (matchId) => apiClient.get(`/scorer/match/${matchId}/roster`),
};

export default apiClient;