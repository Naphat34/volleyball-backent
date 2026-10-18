import React, { useState } from 'react';
import { api } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { User, Lock, Trophy, MapPin, ImagePlus, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const initialForm = {
  username: '', password: '', confirm_password: '', role: 'team_staff', name: '',
  code: '', logo_url: '',
  manager_name: '', email: '', phone: '', mobile_phone: '', office_phone: '', fax: '', line_id: '',
  province: '', district: '', category: 'Male', address_number: '', building: '', moo: '',
  soi: '', road: '', address_province: '', address_district: '', subdistrict: '', postal_code: ''
};

export default function Register() {
  const { language, setLanguage, t } = useLanguage();
  const [formData, setFormData] = useState(initialForm);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const passwordChecks = [
    { label: 'อย่างน้อย 8 ตัวอักษร', valid: formData.password.length >= 8 },
    { label: 'มีตัวพิมพ์ใหญ่ (A-Z)', valid: /[A-Z]/.test(formData.password) },
    { label: 'มีตัวพิมพ์เล็ก (a-z)', valid: /[a-z]/.test(formData.password) },
    { label: 'มีตัวเลข (0-9)', valid: /[0-9]/.test(formData.password) },
    { label: 'มีอักขระพิเศษ เช่น ! @ # $ %', valid: /[^A-Za-z0-9]/.test(formData.password) }
  ];
  const isPasswordValid = passwordChecks.every((check) => check.valid);

  const handleChange = (event) => setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  const handleLogoFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      Swal.fire({ icon: 'error', title: 'ไฟล์รูปภาพไม่ถูกต้อง', text: 'รองรับไฟล์ JPG, PNG, WEBP หรือ GIF' });
      event.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      Swal.fire({ icon: 'error', title: 'ไฟล์มีขนาดใหญ่เกินไป', text: 'กรุณาเลือกรูปภาพขนาดไม่เกิน 2MB' });
      event.target.value = '';
      return;
    }

    setLogoUploading(true);
    try {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('อ่านไฟล์รูปภาพไม่สำเร็จ'));
        reader.readAsDataURL(file);
      });
      const response = await api.uploadRegistrationTeamLogo(image);
      setFormData((current) => ({ ...current, logo_url: response.data.url }));
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'อัปโหลดโลโก้ไม่สำเร็จ', text: error.response?.data?.error || error.message });
    } finally {
      setLogoUploading(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading || logoUploading) return;
    if (!isPasswordValid) {
      Swal.fire({
        icon: 'error',
        title: 'รหัสผ่านยังไม่ครบเงื่อนไข',
        text: 'ต้องมีอย่างน้อย 8 ตัวอักษร และประกอบด้วยตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก ตัวเลข และอักขระพิเศษ'
      });
      return;
    }
    if (formData.password !== formData.confirm_password) {
      Swal.fire({ icon: 'error', title: 'ยืนยันรหัสผ่านไม่ตรงกัน', text: 'กรุณาตรวจสอบรหัสผ่านอีกครั้ง' });
      return;
    }
    setLoading(true);
    try {
      await api.register({ ...formData, code: formData.code.trim().toUpperCase(), phone: formData.mobile_phone });
      Swal.fire({ icon: 'success', title: t('register.successTitle'), text: t('register.successText'), timer: 3000, showConfirmButton: false })
        .then(() => navigate('/login'));
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('register.failTitle'), text: err.response?.data?.error || t('register.failText'), confirmButtonColor: '#3b82f6' });
    } finally {
      setLoading(false);
    }
  };

  const section = (title, Icon, children) => (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 border-b border-gray-100 pb-2 text-sm font-bold tracking-wide text-blue-700"><Icon size={17} />{title}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
  const field = (label, name, options = {}) => (
    <label key={name} className="space-y-1.5 text-xs font-semibold text-gray-600">
      <span>{label}{options.required && <span className="text-red-500"> *</span>}</span>
      <input name={name} type={options.type || 'text'} value={formData[name]} onChange={handleChange} required={options.required}
        autoComplete={options.autoComplete} maxLength={options.maxLength} minLength={options.minLength}
        pattern={options.pattern} title={options.title}
        className="w-full rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/30" />
    </label>
  );

  return (
    <main className="min-h-screen bg-[#122b52] px-4 py-10 font-sans">
      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-2xl md:p-10">
        <div className="mb-8 flex justify-end gap-2">
          {['THA', 'ENG'].map((lang) => <button key={lang} type="button" onClick={() => setLanguage(lang)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${language === lang ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{lang === 'THA' ? 'TH' : 'EN'}</button>)}
        </div>
        <header className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Trophy size={28} /></div>
          <h1 className="text-3xl font-extrabold text-slate-950">{t('register.title')}</h1>
          <p className="mt-2 text-sm text-gray-500">ลงทะเบียนทีมเข้าร่วมการแข่งขัน</p>
        </header>
        <form onSubmit={handleSubmit} className="space-y-8">
          {section('1. ข้อมูลทีม', Trophy, <>
            {field('โรงเรียน / สังกัด', 'name', { required: true })}
            {field('รหัสทีม (Code ทีม)', 'code', { required: true, maxLength: 10, autoComplete: 'off' })}
            {field('จังหวัด', 'province', { required: true })}
            {field('อำเภอ / เขต', 'district', { required: true })}
            <label className="space-y-1.5 text-xs font-semibold text-gray-600">
              <span>ประเภททีม <b className="text-red-500">*</b></span>
              <select name="category" value={formData.category} onChange={handleChange} className="w-full rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm">
                <option value="Male">ทีมชาย</option>
                <option value="Female">ทีมหญิง</option>
              </select>
            </label>
            <div className="space-y-2 text-xs font-semibold text-gray-600">
              <span>โลโก้ทีม</span>
              <div className="flex min-h-24 items-center gap-4 rounded-xl border border-dashed border-gray-300 bg-gray-50/70 p-3">
                {formData.logo_url ? <img src={formData.logo_url} alt="ตัวอย่างโลโก้ทีม" className="h-16 w-16 rounded-lg bg-white object-contain p-1" /> : <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white text-gray-400"><ImagePlus size={26} /></div>}
                <div className="min-w-0 flex-1">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
                    <ImagePlus size={15} />{logoUploading ? 'กำลังอัปโหลด…' : formData.logo_url ? 'เปลี่ยนโลโก้' : 'เลือกรูปโลโก้'}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={logoUploading} onChange={handleLogoFileChange} />
                  </label>
                  <p className="mt-1.5 text-[11px] font-normal text-gray-500">JPG, PNG, WEBP หรือ GIF ขนาดไม่เกิน 2MB</p>
                </div>
                {formData.logo_url && <button type="button" aria-label="ลบโลโก้ทีม" onClick={() => setFormData((current) => ({ ...current, logo_url: '' }))} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"><X size={17} /></button>}
              </div>
            </div>
          </>)}
          {section('2. ผู้จัดการทีม / ผู้ประสานงาน', User, <>
            {field('ชื่อ-สกุล', 'manager_name', { required: true })}
            {field('อีเมล', 'email', { type: 'email', required: true, autoComplete: 'email' })}
            {field('โทรศัพท์', 'office_phone', { type: 'tel' })}
            {field('เบอร์มือถือ', 'mobile_phone', { type: 'tel', required: true })}
            {field('โทรสาร', 'fax', { type: 'tel' })}
            {field('Line ID', 'line_id')}
          </>)}
          {section('3. ที่อยู่สำหรับติดต่อ', MapPin, <>
            {field('เลขที่ / ห้อง', 'address_number', { required: true })}
            {field('หมู่บ้าน / อาคาร', 'building')}
            {field('หมู่ที่', 'moo')}
            {field('ซอย / ตรอก', 'soi')}
            {field('ถนน', 'road')}
            {field('จังหวัด', 'address_province', { required: true })}
            {field('เขต / อำเภอ', 'address_district', { required: true })}
            {field('แขวง / ตำบล', 'subdistrict', { required: true })}
            {field('รหัสไปรษณีย์', 'postal_code', { required: true, maxLength: 10 })}
          </>)}
          {section('4. บัญชีเข้าใช้งาน', Lock, <>
            {field('ชื่อผู้ใช้งาน', 'username', { required: true, autoComplete: 'username' })}
            {field('รหัสผ่าน', 'password', {
              type: 'password',
              required: true,
              minLength: 8,
              pattern: '(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}',
              title: 'ต้องมีอย่างน้อย 8 ตัวอักษร มีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก ตัวเลข และอักขระพิเศษ',
              autoComplete: 'new-password'
            })}
            <ul aria-live="polite" className="-mt-2 space-y-1 text-xs font-medium">
              {passwordChecks.map(({ label, valid }) => (
                <li key={label} className={valid ? 'text-emerald-700' : 'text-gray-500'}>
                  <span aria-hidden="true" className="mr-2">{valid ? '✓' : '○'}</span>{label}
                </li>
              ))}
            </ul>
            {field('ยืนยันรหัสผ่าน', 'confirm_password', { type: 'password', required: true, minLength: 8, autoComplete: 'new-password' })}
          </>)}
          <button type="submit" disabled={loading || logoUploading} className="w-full rounded-xl bg-blue-600 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-blue-700 disabled:bg-gray-400">{loading ? t('register.submitting') : t('register.registerBtn')}</button>
        </form>
        <p className="mt-7 border-t border-gray-100 pt-6 text-center text-sm text-gray-500">{t('register.haveAccount')} <Link to="/login" className="font-bold text-blue-600 hover:underline">{t('register.loginHere')}</Link></p>
      </div>
      <footer className="mt-6 text-center text-xs text-white/70">© {new Date().getFullYear()} Volley Manager || สงวนลิขสิทธิ์ ชมรมกีฬาวอลเลย์บอลแห่งจังหวัดพัทลุง</footer>
    </main>
  );
}
