import { api } from './api';

// --- Competitions ---
const getAllCompetitions = () => api.get('/admin/competitions');
const getOpenCompetitions = () => api.get('/competitions/open');
const createCompetition = (data) => api.post('/admin/competitions', data);
const updateCompetition = (id, data) => api.put(`/admin/competitions/${id}`, data);
const updateCompetitionStatus = (id, status) => api.put(`/admin/competitions/${id}/status`, { status });
const deleteCompetition = (id) => api.delete(`/admin/competitions/${id}`);
const generateMatches = (competitionId) => api.post(`/competitions/${competitionId}/generate-matches`);

// --- Teams / Clubs ---
const getAllTeams = () => api.get('/admin/teams');
const getTeamsByCompetition = (competitionId) => api.get(`/admin/competitions/${competitionId}/teams`);
const createTeam = (data) => api.post('/admin/teams', data);
const updateTeam = (id, data) => api.put(`/admin/teams/${id}`, data);
const deleteTeam = (id) => api.delete(`/admin/teams/${id}`);
const getMyTeam = () => api.get('/my-team');
const updateMyTeam = (data) => api.put('/my-team', data);
const createMyTeam = (data) => api.post('/my-team/create', data);
const deleteMyTeam = () => api.delete('/my-team');

// --- Players ---
const getPlayersByTeam = (teamId) => api.get(`/teams/${teamId}/players`);
const getMyPlayers = () => api.get('/teams/my-team/players');
const addPlayer = (data) => api.post('/players', data);
const updatePlayer = (id, data) => api.put(`/players/${id}`, data);
const deletePlayer = (id) => api.delete(`/players/${id}`);

// --- Staff ---
const getMyStaff = () => api.get('/teams/my-team/staff');
const getStaffByTeam = (teamId) => api.get(`/teams/${teamId}/staff`);
const addStaff = (data) => api.post('/staff', data);

// --- Matches ---
const getMatchesByCompetition = (competitionId) => api.get(`/competitions/${competitionId}/matches`);
const createMatch = (data) => api.post('/matches', data);
const updateMatch = (id, data) => api.put(`/matches/${id}`, data);
const deleteMatch = (id) => api.delete(`/matches/${id}`);
const getMatchScoresheetData = (matchId) => api.get(`/scorer/match/${matchId}/scoresheet`);
const getMatchRosterData = (matchId) => api.get(`/scorer/match/${matchId}/roster`);
const updateMatchResult = (id, data) => api.put(`/matches/${id}/result`, data);

// --- Match Actions (E-Score) ---
const createMatchAction = (data) => api.post('/match-actions', data);

// --- Users & Auth ---
const login = (credentials) => api.post('/auth/login', credentials);
const logout = () => api.post('/auth/logout');
const register = (data) => api.post('/auth/register', data);
const getAllUsers = () => api.get('/admin/users');
const getPendingUsers = () => api.get('/admin/users/pending');
const createUser = (data) => api.post('/admin/users', data);
const updateUser = (id, data) => api.put(`/admin/users/${id}`, data);
const deleteUser = (id) => api.delete(`/admin/users/${id}`);
const approveUser = (id, status) => api.put(`/admin/users/${id}/approve`, { status });

// --- Team & Competition Registration ---
const getMyCompetitions = () => api.get('/teams/my-team/competitions');
const joinCompetition = (competitionId) => api.post(`/competitions/${competitionId}/join`);
const leaveCompetition = (competitionId) => api.delete(`/competitions/${competitionId}/leave`);


export const apiService = {
    getAllCompetitions,
    getOpenCompetitions,
    createCompetition,
    updateCompetition,
    updateCompetitionStatus,
    deleteCompetition,
    generateMatches,
    getAllTeams,
    getTeamsByCompetition,
    createTeam,
    updateTeam,
    deleteTeam,
    getMyTeam,
    updateMyTeam,
    createMyTeam,
    deleteMyTeam,
    getPlayersByTeam,
    getMyPlayers,
    addPlayer,
    updatePlayer,
    deletePlayer,
    getMyStaff,
    getStaffByTeam,
    addStaff,
    getMatchesByCompetition,
    createMatch,
    updateMatch,
    deleteMatch,
    updateMatchResult,
    createMatchAction,
    login,
    logout,
    register,
    getAllUsers,
    getPendingUsers,
    createUser,
    updateUser,
    deleteUser,
    approveUser,
    getMyCompetitions,
    joinCompetition,
    leaveCompetition,
    getMatchScoresheetData,
    getMatchRosterData
};