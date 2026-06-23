import React, { useState } from 'react';
import { api } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { User, Lock, Trophy, Phone, MapPin, Users, FileText, Eye, EyeOff, Mail } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function Register() {
  const { language, setLanguage, t } = useLanguage();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'team_staff',
    name: '',
    code: '',
    manager_name: '',
    coach: '',
    phone: '',
    email: '',
    province: '',
    category: 'Male'
  });

  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.register(formData);
      
      Swal.fire({
        icon: 'success',
        title: t('register.successTitle'),
        text: t('register.successText'),
        timer: 3000,
        showConfirmButton: false
      }).then(() => {
        navigate('/login');
      });

    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: t('register.failTitle'),
        text: err.response?.data?.error || t('register.failText'),
        confirmButtonColor: '#3b82f6'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-gradient-to-tr from-[#1e40af] via-[#3b82f6] to-[#60a5fa] overflow-hidden font-sans pb-24">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-25 flex gap-2">
        <button
          onClick={() => setLanguage('THA')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            language === 'THA'
              ? 'bg-white text-blue-600 shadow-md scale-105'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
        >
          TH
        </button>
        <button
          onClick={() => setLanguage('ENG')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            language === 'ENG'
              ? 'bg-white text-blue-600 shadow-md scale-105'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
        >
          EN
        </button>
      </div>

      {/* Background decoration elements */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-indigo-400/20 blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="flex-grow flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-4xl bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_20px_50px_rgba(30,64,175,0.3)] border border-white/20 p-8 md:p-10 transition-all duration-300 hover:shadow-[0_25px_60px_rgba(30,64_175,0.4)]">
          
          {/* Logo & Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 border border-blue-100 shadow-inner mb-4">
              <Trophy className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {t('register.title')}
            </h1>
            <p className="text-sm text-gray-500 mt-2 font-medium">
              {t('register.subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* ส่วนที่ 1: ข้อมูลบัญชีผู้ใช้ */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase text-blue-600 tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
                <User size={16} /> {t('register.accountInfo')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InputField 
                  label={t('register.username')} 
                  name="username" 
                  icon={<User size={18}/>} 
                  value={formData.username} 
                  onChange={handleChange} 
                  required 
                  placeholder={t('login.usernamePlaceholder')}
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600 ml-1">{t('register.password')}</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <Lock size={18}/>
                    </div>
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      name="password" 
                      value={formData.password || ''} 
                      onChange={handleChange} 
                      required 
                      placeholder={t('register.enterPassword')}
                      className="w-full pl-12 pr-11 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ส่วนที่ 2: ข้อมูลสโมสร */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase text-blue-600 tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
                <Trophy size={16} /> {t('register.clubDetails')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InputField 
                  label={t('register.teamName')} 
                  name="name" 
                  icon={<Users size={18}/>} 
                  value={formData.name} 
                  onChange={handleChange} 
                  required 
                  placeholder={t('register.teamName')}
                />
                <InputField 
                  label={t('register.teamCode')} 
                  name="code" 
                  icon={<FileText size={18}/>} 
                  maxLength={10} 
                  value={formData.code} 
                  onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})} 
                  required 
                  placeholder={t('register.teamCode')}
                />
                <InputField 
                  label={t('register.managerName')} 
                  name="manager_name" 
                  icon={<User size={18}/>} 
                  value={formData.manager_name} 
                  onChange={handleChange} 
                  required 
                  placeholder={t('register.managerName')}
                />
                <InputField 
                  label={t('register.coach')} 
                  name="coach" 
                  icon={<User size={18}/>} 
                  value={formData.coach} 
                  onChange={handleChange} 
                  placeholder={t('register.coach')}
                />
                <InputField 
                  label={t('register.phone')} 
                  name="phone" 
                  icon={<Phone size={18}/>} 
                  value={formData.phone} 
                  onChange={handleChange} 
                  required 
                  placeholder={t('register.phone')}
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600 ml-1">{t('register.category')}</label>
                  <select 
                    name="category" 
                    value={formData.category} 
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200 font-medium"
                  >
                    <option value="Male">{t('common.men')} (Male)</option>
                    <option value="Female">{t('common.women')} (Female)</option>
                    <option value="Mixed">Mixed</option>
                  </select>
                </div>
                <InputField 
                  label={t('register.province')} 
                  name="province" 
                  icon={<MapPin size={18}/>} 
                  value={formData.province} 
                  onChange={handleChange} 
                  required 
                  placeholder={t('register.province')}
                />
                <InputField 
                  label={t('register.email')} 
                  name="email" 
                  type="email" 
                  icon={<Mail size={18}/>} 
                  value={formData.email} 
                  onChange={handleChange} 
                  placeholder={t('register.email')}
                />
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className={`w-full ${loading ? 'bg-gray-400' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'} text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:shadow-indigo-500/30 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer text-lg mt-6`}
            >
              {loading ? t('register.submitting') : t('register.registerBtn')}
            </button>
          </form>
          
          {/* Link back to Login */}
          <div className="mt-8 text-center border-t border-gray-100 pt-6">
             <p className="text-sm text-gray-500">
               {t('register.haveAccount')}&nbsp;
               <Link to="/login" className="font-bold text-blue-600 hover:text-indigo-600 hover:underline transition-colors">
                 {t('register.loginHere')}
               </Link>
             </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 w-full bg-black/20 backdrop-blur-md border-t border-white/10 py-4 px-4 z-20 text-center">
        <div className="max-w-7xl mx-auto">
          <p className="text-white/90 text-sm font-medium">
            © {new Date().getFullYear()} Volley Manager. All rights reserved.
          </p>
          <p className="text-white/60 text-xs mt-0.5">
            {t('login.subtitle')}
          </p>
        </div>
      </footer>
    </div>
  );
}

// Helper Component สำหรับ Input
function InputField({ label, name, value, onChange, required, icon, type = "text", maxLength, placeholder }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-600 ml-1">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>}
        <input 
          type={type} 
          name={name} 
          value={value || ''} 
          onChange={onChange} 
          required={required} 
          maxLength={maxLength}
          placeholder={placeholder || `Enter ${label.toLowerCase()}`}
          className={`w-full ${icon ? 'pl-12' : 'px-4'} py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200`}
        />
      </div>
    </div>
  );
}