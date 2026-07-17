import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import {
  Key, Loader2, Mail, Phone, Plus, Save, Search, Shield, Trash2, Trophy, Users, X
} from 'lucide-react';
import Swal from 'sweetalert2';

const normalizeGender = (value) => {
  const gender = String(value || '').trim().toLowerCase();
  if (['male', 'men', 'm', 'ชาย'].includes(gender)) return 'Male';
  if (['female', 'women', 'w', 'f', 'หญิง'].includes(gender)) return 'Female';
  return '';
};

const genderLabel = (value) => {
  const gender = normalizeGender(value);
  if (gender === 'Male') return 'ชาย';
  if (gender === 'Female') return 'หญิง';
  return 'ไม่ระบุประเภท';
};

const statusClass = (status) => {
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'rejected') return 'bg-red-50 text-red-700 border-red-100';
  return 'bg-amber-50 text-amber-700 border-amber-100';
};

const statusLabel = (status) => {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  return 'pending';
};

const teamMatchesSearch = (team, searchTerm) => {
  const keyword = searchTerm.trim().toLowerCase();
  if (!keyword) return true;

  return [
    team.team_name,
    team.team_code,
    team.name,
    team.code,
    team.competition_title,
    team.age_group_name,
    team.entry_gender,
  ].some((value) => String(value || '').toLowerCase().includes(keyword));
};

export default function ClubsTab() {
  const [teams, setTeams] = useState([]);
  const [teamEntries, setTeamEntries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    manager_name: '',
    coach: '',
    phone: '',
    email: '',
    province: '',
    logo_url: '',
    username: '',
    password: '',
    create_account: true,
  });

  const fetchTeams = async () => {
    try {
      const [teamsRes, entriesRes] = await Promise.all([
        api.getAllTeams(),
        api.getAllTeamEntries(),
      ]);
      setTeams(teamsRes.data || []);
      setTeamEntries(entriesRes.data || []);
    } catch (err) {
      console.error('Fetch teams failed', err);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      code: '',
      manager_name: '',
      coach: '',
      phone: '',
      email: '',
      province: '',
      logo_url: '',
      username: '',
      password: '',
      create_account: true,
    });
  };

  const handleCreateInput = (event) => {
    const { name, value, type, checked } = event.target;
    setCreateForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const openCreateModal = () => {
    resetCreateForm();
    setIsCreateOpen(true);
  };

  const closeCreateModal = () => {
    if (isCreating) return;
    setIsCreateOpen(false);
    resetCreateForm();
  };

  const handleCreateTeam = async (event) => {
    event.preventDefault();
    if (!createForm.name.trim() || !createForm.code.trim()) {
      return Swal.fire('Missing data', 'Team name and code are required.', 'warning');
    }
    if (createForm.create_account && (!createForm.username.trim() || !createForm.password.trim())) {
      return Swal.fire('Missing account', 'Username and password are required.', 'warning');
    }

    setIsCreating(true);
    try {
      await api.createTeam({
        ...createForm,
        name: createForm.name.trim(),
        code: createForm.code.trim(),
        username: createForm.create_account ? createForm.username.trim() : '',
        password: createForm.create_account ? createForm.password : '',
      });
      await fetchTeams();
      setIsCreateOpen(false);
      resetCreateForm();
      Swal.fire('Created', 'Team and account were created successfully.', 'success');
    } catch (err) {
      Swal.fire('Error', err.response?.data?.error || 'Could not create team.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredEntries = useMemo(
    () => teamEntries.filter((entry) => teamMatchesSearch(entry, searchTerm)),
    [teamEntries, searchTerm]
  );

  const groupedEntries = useMemo(() => {
    const groups = new Map();

    filteredEntries.forEach((entry) => {
      const key = [
        entry.competition_id,
        entry.entry_age_group_id || 'general',
        normalizeGender(entry.entry_gender || entry.competition_gender) || 'unknown',
      ].join('__');

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          competitionTitle: entry.competition_title || 'ไม่ระบุรายการแข่งขัน',
          sport: entry.sport || '-',
          ageGroupName: entry.age_group_name || 'ไม่ระบุรุ่น',
          gender: entry.entry_gender || entry.competition_gender,
          teams: [],
        });
      }

      groups.get(key).teams.push(entry);
    });

    return Array.from(groups.values()).sort((a, b) => {
      const compCompare = a.competitionTitle.localeCompare(b.competitionTitle, 'th');
      if (compCompare !== 0) return compCompare;
      const ageCompare = a.ageGroupName.localeCompare(b.ageGroupName, 'th');
      if (ageCompare !== 0) return ageCompare;
      return genderLabel(a.gender).localeCompare(genderLabel(b.gender), 'th');
    });
  }, [filteredEntries]);

  const registeredTeamIds = useMemo(
    () => new Set(teamEntries.map((entry) => Number(entry.team_id))),
    [teamEntries]
  );

  const unregisteredTeams = useMemo(
    () => teams
      .filter((team) => !registeredTeamIds.has(Number(team.id)))
      .filter((team) => teamMatchesSearch(team, searchTerm)),
    [teams, registeredTeamIds, searchTerm]
  );

  const handleDeleteTeam = (teamId) => {
    Swal.fire({
      title: 'ลบทีมแข่งขัน?',
      text: 'การลบทีมจะลบข้อมูลนักกีฬา เจ้าหน้าที่ และข้อมูลที่เกี่ยวข้องกับทีมนี้',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'ยืนยันการลบ',
      cancelButtonText: 'ยกเลิก',
    }).then((result) => {
      if (result.isConfirmed) {
        api.deleteTeam(teamId)
          .then(() => {
            fetchTeams();
            Swal.fire('ลบเรียบร้อย', '', 'success');
          })
          .catch((err) => Swal.fire('ผิดพลาด', err.response?.data?.error || 'ไม่สามารถลบทีมได้', 'error'));
      }
    });
  };

  const handleUpdateRegistrationStatus = async (entry, status) => {
    const label = status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'set pending';
    const result = await Swal.fire({
      title: `${label} registration?`,
      text: `${entry.team_name || entry.name} / ${entry.age_group_name || 'General'} / ${entry.entry_gender || entry.competition_gender || '-'}`,
      icon: status === 'rejected' ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonText: label,
      cancelButtonText: 'Cancel',
      confirmButtonColor: status === 'rejected' ? '#ef4444' : '#059669',
    });

    if (!result.isConfirmed) return;

    try {
      await api.updateTeamEntryStatus(entry.team_entry_id, status);
      await fetchTeams();
      Swal.fire('Updated', `Registration is now ${status}.`, 'success');
    } catch (err) {
      Swal.fire('Error', err.response?.data?.error || 'Could not update registration status.', 'error');
    }
  };

  const renderTeamRow = (team, isEntry = true) => {
    const teamId = isEntry ? team.team_id : team.id;
    const teamName = isEntry ? team.team_name : team.name;
    const teamCode = isEntry ? team.team_code : team.code;

    return (
      <tr key={isEntry ? team.team_entry_id : `team-${team.id}`} className="hover:bg-gray-50 transition-colors group">
        <td className="px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
              {team.logo_url ? (
                <img src={team.logo_url} className="w-full h-full object-contain p-1.5" alt="" />
              ) : (
                <Users size={18} className="text-gray-300" />
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-900 leading-tight">{teamName}</p>
              <span className="text-[12px] font-bold text-gray-500 uppercase">{teamCode || '-'}</span>
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <p className="text-sm font-medium text-gray-700">{team.manager_name || team.coach || '-'}</p>
          <div className="mt-1 flex gap-1">
            {team.phone && <span className="p-1.5 bg-gray-50 text-gray-400 rounded-md"><Phone size={13} /></span>}
            {team.email && <span className="p-1.5 bg-gray-50 text-gray-400 rounded-md"><Mail size={13} /></span>}
          </div>
        </td>
        <td className="px-6 py-4 text-center">
          {isEntry ? (
            <span className="font-semibold text-gray-900">{Number(team.player_count || 0)}</span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </td>
        <td className="px-6 py-4 text-center">
          {isEntry ? (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${statusClass(team.registration_status)}`}>
              {statusLabel(team.registration_status)}
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold bg-gray-50 text-gray-500 border-gray-100">
              ยังไม่ได้สมัคร
            </span>
          )}
        </td>
        <td className="px-6 py-4 text-right">
          {isEntry && (
            <div className="mb-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleUpdateRegistrationStatus(team, 'approved')}
                disabled={team.registration_status === 'approved'}
                className="rounded-md border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleUpdateRegistrationStatus(team, 'rejected')}
                disabled={team.registration_status === 'rejected'}
                className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
              >
                Reject
              </button>
            </div>
          )}
          <button
            onClick={() => handleDeleteTeam(teamId)}
            className="p-2.5 text-gray-300 hover:text-red-500 rounded-md transition-all opacity-0 group-hover:opacity-100"
            title="ลบทีม"
          >
            <Trash2 size={18} />
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">ทีมแข่งขันตามรุ่นและประเภท</h2>
          <p className="text-sm text-gray-500 mt-1">ตรวจสอบทีมที่สมัครในแต่ละรายการแข่งขัน รุ่นอายุ และประเภทชาย/หญิง</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
        >
          <Plus size={18} />
          Create Team Account
        </button>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-3.5 text-gray-300" size={18} />
          <input
            type="text"
            placeholder="ค้นหาทีม รายการ รุ่น หรือประเภท..."
            className="w-full pl-12 pr-6 py-3.5 bg-white rounded-lg border border-gray-200 outline-none font-medium focus:ring-2 focus:ring-gray-100 focus:border-gray-400"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase">ทีมทั้งหมด</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{teams.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase">รายการสมัคร</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{teamEntries.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase">ยังไม่ได้สมัคร</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{teams.length - registeredTeamIds.size}</p>
        </div>
      </div>

      {groupedEntries.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center text-gray-500">
          ไม่พบข้อมูลทีมที่สมัครแข่งขัน
        </div>
      ) : (
        groupedEntries.map((group) => (
          <section key={group.key} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-gray-900 font-semibold">
                  <Trophy size={18} className="text-gray-500" />
                  {group.competitionTitle}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 border border-gray-100">
                    <Shield size={13} /> {group.ageGroupName}
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-50 border border-gray-100">
                    ประเภท{genderLabel(group.gender)}
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-50 border border-gray-100">
                    {group.teams.length} ทีม
                  </span>
                </div>
              </div>
              <span className="text-xs font-semibold text-gray-400 uppercase">{group.sport}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-[10px] font-semibold uppercase text-gray-400 tracking-widest">ทีม</th>
                    <th className="px-6 py-3 text-[10px] font-semibold uppercase text-gray-400 tracking-widest">ผู้จัดการ / โค้ช</th>
                    <th className="px-6 py-3 text-[10px] font-semibold uppercase text-gray-400 tracking-widest text-center">นักกีฬา</th>
                    <th className="px-6 py-3 text-[10px] font-semibold uppercase text-gray-400 tracking-widest text-center">สถานะ</th>
                    <th className="px-6 py-3 text-[10px] font-semibold uppercase text-gray-400 tracking-widest text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {group.teams.map((team) => renderTeamRow(team))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      {unregisteredTeams.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
              <Users size={18} className="text-gray-500" />
              ทีมที่ยังไม่ได้สมัครแข่งขัน
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <tbody className="divide-y divide-gray-100">
                {unregisteredTeams.map((team) => renderTeamRow(team, false))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Create Team Account</h3>
                <p className="text-sm text-gray-500">Create a team and login account for team staff.</p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-md p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="max-h-[calc(92vh-73px)] overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Team Name</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input
                      name="name"
                      value={createForm.name}
                      onChange={handleCreateInput}
                      required
                      className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="School / Club name"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Team Code</label>
                  <input
                    name="code"
                    value={createForm.code}
                    onChange={handleCreateInput}
                    required
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="TEAM01"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Manager Name</label>
                  <input
                    name="manager_name"
                    value={createForm.manager_name}
                    onChange={handleCreateInput}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Manager"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Coach</label>
                  <input
                    name="coach"
                    value={createForm.coach}
                    onChange={handleCreateInput}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Head coach"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                  <input
                    name="phone"
                    value={createForm.phone}
                    onChange={handleCreateInput}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Phone number"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={createForm.email}
                    onChange={handleCreateInput}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="team@example.com"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Province</label>
                  <input
                    name="province"
                    value={createForm.province}
                    onChange={handleCreateInput}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Province"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Logo URL</label>
                  <input
                    name="logo_url"
                    value={createForm.logo_url}
                    onChange={handleCreateInput}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <input
                    type="checkbox"
                    name="create_account"
                    checked={createForm.create_account}
                    onChange={handleCreateInput}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Create login account for this team
                </label>

                {createForm.create_account && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Username</label>
                      <div className="relative">
                        <Shield className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input
                          name="username"
                          value={createForm.username}
                          onChange={handleCreateInput}
                          required={createForm.create_account}
                          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          placeholder="team_username"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input
                          type="text"
                          name="password"
                          value={createForm.password}
                          onChange={handleCreateInput}
                          required={createForm.create_account}
                          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          placeholder="Initial password"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={isCreating}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:bg-gray-300"
                >
                  {isCreating ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
