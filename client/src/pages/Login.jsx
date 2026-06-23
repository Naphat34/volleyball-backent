import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2'; 
import { User, Lock, Eye, EyeOff, LogIn, Trophy } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import Logo from '../assets/img/Logo1.png';

export default function Login() {
  const { language, setLanguage, t } = useLanguage();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role === 'admin') {
          navigate('/admin');
        } else if (user.role === 'score') {
          navigate('/adminscorer');
        } else if (user.team_id) {
          navigate('/team-dashboard');
        } else {
          navigate('/create-team');
        }
      } catch (e) {
        console.error("Error auto-redirecting user:", e);
      }
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await api.login({
        username: formData.username,
        password: formData.password,
      });

      const { user, token } = response.data;
      const { role, status, team_id } = user;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));


      if (role === "admin") {
        await Swal.fire({
          icon: "success",
          title: t('login.successTitle'),
          text: t('login.successAdmin'),
          timer: 1500,
          showConfirmButton: false,
        });
        navigate("/admin");
        return;
      }

      // เพิ่ม redirect สำหรับ scorer
      if (role === "score") {
        await Swal.fire({
          icon: "success",
          title: t('login.successTitle'),
          text: t('login.successScorer'),
          timer: 1500,
          showConfirmButton: false,
        });
        navigate("/adminscorer");
        return;
      }

      if (status !== "approved") {
        await Swal.fire({
          icon: "warning",
          title: t('login.pendingTitle'),
          text: t('login.pendingText'),
        });

        await api.logout();
        return;
      }

      await Swal.fire({
        icon: "success",
        title: t('login.successTitle'),
        text: t('login.successUser'),
        timer: 1500,
        showConfirmButton: false,
      });

      if (team_id) {
        navigate("/team-dashboard");
      } else {
        navigate("/create-team");
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: t('login.failTitle'),
        text: err.response?.data?.error || t('login.failText'),
        confirmButtonColor: "#0243c6ff",
      });
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
        <div className="w-full max-w-md bg-white/70 backdrop-blur-md rounded-2xl shadow-[0_20px_50px_rgba(30,64,175,0.3)] border border-white/20 p-8 md:p-10 transition-all duration-300 hover:shadow-[0_25px_60px_rgba(30,64,175,0.4)]">
          
          {/* Logo & Header */}
          <div className="text-center mb-8">            
            <img src={Logo} alt="Logo" className='w-[300px] mx-auto mb-4'/>           
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {t('login.title')}
            </h1>
            <p className="text-sm text-gray-500 mt-2 font-medium">
              {t('login.subtitle')}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t('login.username')}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </span>
                <input
                  name="username"
                  type="text"
                  required
                  placeholder={t('login.usernamePlaceholder')}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200"
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t('login.password')}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </span>
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder={t('login.passwordPlaceholder')}
                  className="w-full pl-11 pr-11 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200"
                  onChange={handleChange}
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

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:shadow-indigo-500/30 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-5 h-5" />
              {t('login.signIn')}
            </button>
          </form>

          {/* Registration Link */}
          <div className="mt-8 text-center border-t border-gray-100 pt-6">
            <p className="text-sm text-gray-500">
              {t('login.noAccount')}&nbsp;
              <Link
                to="/register"
                className="font-bold text-blue-600 hover:text-indigo-600 hover:underline transition-colors"
              >
                {t('login.registerHere')}
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
        </div>
      </footer>
    </div>
  );
}