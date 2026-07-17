import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';
import { Users, Trophy, CheckCircle2, Calendar, MapPin, ChevronRight, Upload, X } from 'lucide-react';
import { formatThaiDate } from '../utils';

const ageGroupOrder = ['U12', 'U14', 'U16', 'U18', 'Open'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const getAgeGroupLabel = (competition) => (
  competition.age_group_name ||
  competition.age_group ||
  competition.category_name ||
  'General'
);

const getGenderLabel = (gender) => {
  const normalized = String(gender || 'Mixed').trim();
  if (/^(male|men|m)$/i.test(normalized)) return 'Male';
  if (/^(female|women|f)$/i.test(normalized)) return 'Female';
  if (/^(mix|mixed)$/i.test(normalized)) return 'Mixed';
  return normalized || 'Mixed';
};

const sortAgeGroupName = (a, b) => {
  const indexA = ageGroupOrder.indexOf(a);
  const indexB = ageGroupOrder.indexOf(b);
  const safeA = indexA === -1 ? 99 : indexA;
  const safeB = indexB === -1 ? 99 : indexB;
  return safeA - safeB || a.localeCompare(b);
};

const readImageFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  if (!file) {
    reject(new Error('No file selected'));
    return;
  }
  if (!file.type.startsWith('image/')) {
    reject(new Error('Please select an image file'));
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    reject(new Error('Image file must be 2MB or smaller'));
    return;
  }

  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Failed to read image file'));
  reader.readAsDataURL(file);
});

export default function CreateTeam() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    coach: '',
    logo_url: ''
  });
  const [competitions, setCompetitions] = useState([]);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('all');
  const [selectedCompIds, setSelectedCompIds] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOpenCompetitions = async () => {
      try {
        const res = await api.getOpenCompetitions();
        setCompetitions(res.data || []);
      } catch (err) {
        console.error('Failed to fetch open competitions', err);
      }
    };

    fetchOpenCompetitions();
  }, []);

  const ageGroupOptions = useMemo(() => {
    const groups = new Map();
    competitions.forEach((competition) => {
      const name = getAgeGroupLabel(competition);
      if (!groups.has(name)) {
        groups.set(name, { name, count: 0 });
      }
      groups.get(name).count += 1;
    });
    return [...groups.values()].sort((a, b) => sortAgeGroupName(a.name, b.name));
  }, [competitions]);

  const visibleCompetitions = useMemo(() => {
    if (selectedAgeGroup === 'all') return competitions;
    return competitions.filter((competition) => getAgeGroupLabel(competition) === selectedAgeGroup);
  }, [competitions, selectedAgeGroup]);

  const toggleCompetitionSelection = (id) => {
    setSelectedCompIds((prev) => (
      prev.includes(id)
        ? prev.filter((competitionId) => competitionId !== id)
        : [...prev, id]
    ));
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogoFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      const res = await api.uploadImage(dataUrl);
      setFormData({ ...formData, logo_url: res.data.url });
    } catch (error) {
      alert(error.response?.data?.error || error.message);
    } finally {
      event.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const competitionIds = [...new Set(
        selectedCompIds.map((id) => Number.parseInt(id, 10)).filter(Boolean)
      )];

      await api.createMyTeam(formData);

      for (const competitionId of competitionIds) {
        await api.joinCompetition(competitionId);
      }

      alert('Team created successfully.');

      const user = JSON.parse(localStorage.getItem('user'));
      navigate(user?.role === 'admin' ? '/admin-dashboard' : '/team-dashboard');
      window.location.reload();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create team');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 lg:p-10 font-sans">
      <div className="bg-white w-full p-8 lg:p-14 rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div className="text-left">
            <h1 className="text-4xl lg:text-5xl font-semibold text-gray-900 tracking-tight">
              New <span className="text-blue-600">Club</span> Registration
            </h1>
            <p className="text-gray-400 mt-3 text-lg font-medium italic">ลงทะเบียนสโมสรใหม่และเลือกการแข่งขัน</p>
          </div>
          <div className="bg-blue-50 p-5 rounded-[2rem] hidden md:block">
            <Users className="w-12 h-12 text-blue-600" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">1</div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-900">Club Profile</h3>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-2 ml-1">Team Name</label>
                <input
                  type="text"
                  name="name"
                  placeholder="ชื่อทีมสโมสร"
                  required
                  className="w-full px-6 py-4 bg-gray-50 rounded-lg focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-bold text-gray-800 shadow-sm shadow-gray-100"
                  onChange={handleChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-2 ml-1">Code</label>
                  <input
                    type="text"
                    name="code"
                    placeholder="เช่น THA"
                    maxLength={10}
                    required
                    className="w-full px-6 py-4 bg-gray-50 rounded-lg focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-mono font-semibold uppercase text-blue-600 shadow-sm shadow-gray-100"
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    value={formData.code}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-2 ml-1">Coach</label>
                  <input
                    type="text"
                    name="coach"
                    placeholder="ชื่อผู้ฝึกสอน"
                    className="w-full px-6 py-4 bg-gray-50 rounded-lg focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-bold text-gray-800 shadow-sm shadow-gray-100"
                    onChange={handleChange}
                  />
                </div>
              </div>

              <ImageUploadField
                label="Team Logo"
                value={formData.logo_url}
                previewAlt={formData.name || 'Team logo'}
                onFileSelect={handleLogoFileChange}
                onClear={() => setFormData({ ...formData, logo_url: '' })}
              />
            </div>
          </div>

          <div className="space-y-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">2</div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-900">Select Competition</h3>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-2 ml-1">Age Group</label>
              <select
                value={selectedAgeGroup}
                onChange={(e) => setSelectedAgeGroup(e.target.value)}
                className="w-full px-6 py-4 bg-white border border-gray-200 rounded-lg focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-semibold text-gray-800 shadow-sm shadow-gray-100"
              >
                <option value="all">All Age Groups</option>
                {ageGroupOptions.map((group) => (
                  <option key={group.name} value={group.name}>
                    {group.name} ({group.count})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-gray-50 p-6 rounded-[2rem] space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
              {visibleCompetitions.length === 0 ? (
                <div className="text-center py-10 opacity-40">
                  <Trophy size={48} className="mx-auto mb-4" />
                  <p className="font-bold">ไม่มีรายการที่เปิดรับสมัคร</p>
                </div>
              ) : (
                visibleCompetitions.map((comp) => {
                  const isSelected = selectedCompIds.includes(comp.id);
                  return (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => toggleCompetitionSelection(comp.id)}
                      className={`w-full text-left group relative flex items-center gap-4 p-5 rounded-3xl cursor-pointer transition-all duration-300 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xl shadow-indigo-200 scale-[1.01]'
                          : 'bg-white hover:bg-blue-50'
                      }`}
                    >
                      <div className={`p-3 rounded-lg transition-colors ${isSelected ? 'bg-white/20' : 'bg-blue-50 text-blue-600'}`}>
                        <Trophy size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                          {comp.title}
                        </p>
                        <div className={`flex flex-wrap gap-3 text-[10px] mt-1 font-bold ${isSelected ? 'text-indigo-100' : 'text-gray-400'}`}>
                          <span className="flex items-center gap-1"><Trophy size={12} /> {getAgeGroupLabel(comp)}</span>
                          <span>{getGenderLabel(comp.gender)}</span>
                          <span className="flex items-center gap-1"><MapPin size={12} /> {comp.location}</span>
                          <span className="flex items-center gap-1"><Calendar size={12} /> {formatThaiDate(comp.start_date)}</span>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="text-white shrink-0" size={24} />}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
              <span>Selected {selectedCompIds.length} category{selectedCompIds.length === 1 ? '' : 'ies'}</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-blue-600 text-white font-semibold text-xl rounded-3xl shadow-2xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:hover:scale-100"
            >
              {loading ? 'Processing...' : (
                <>
                  Complete Registration <ChevronRight size={24} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImageUploadField({ label, value, onFileSelect, onClear, previewAlt }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase text-gray-400 mb-2 ml-1">{label}</label>
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
          {value ? (
            <img src={value} alt={previewAlt} className="w-full h-full object-cover" />
          ) : (
            <Users size={28} className="text-gray-300" />
          )}
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gray-50 text-sm font-semibold text-gray-700 shadow-sm shadow-gray-100 hover:bg-white hover:ring-4 hover:ring-indigo-50 cursor-pointer transition-all">
              <Upload size={16} />
              <span>Browse</span>
              <input type="file" accept="image/*" className="hidden" onChange={onFileSelect} />
            </label>
            {value && (
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center justify-center w-11 h-11 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:bg-red-50 transition"
                aria-label="Remove image"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <span className="text-xs text-gray-400">JPG, PNG, WebP up to 2MB</span>
        </div>
      </div>
    </div>
  );
}
