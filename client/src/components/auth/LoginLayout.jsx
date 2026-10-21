import { User, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '../../assets/img/Logo_Phatthalung.png';
import '../../pages/auth/Login.css';

export default function LoginLayout({ language, setLanguage, t, formError, recoveryPath, submitting,
    showPassword, setShowPassword, handleChange, handleSubmit, offlineForm }) {
    const th = language === 'THA';
    const description = th ? 'ระบบจัดการแข่งขันวอลเลย์บอล' : 'Volleyball competition management';
    return <div className="login-page">
        <header className="login-topbar"><span>VOLLEY MANAGER</span><div aria-label={th ? 'ภาษา' : 'Language'}>{[['THA', 'TH'], ['ENG', 'EN']].map(([value, text]) => <button type="button" key={value} aria-pressed={language === value} onClick={() => setLanguage(value)}>{text}</button>)}</div></header>
        <main className="login-main"><section className="login-card" aria-labelledby="login-title">
            <div className="login-brand"><img src={Logo} alt="Phatthalung Volleyball Club" /><div><h1 id="login-title">Volley Manager</h1><p>{description}</p></div></div>
            <div className="login-heading"><h2>{th ? 'เข้าสู่ระบบ' : 'Sign in'}</h2><p>{th ? 'ใช้บัญชีของคุณเพื่อเริ่มทำงานออนไลน์' : 'Use your account to work online.'}</p></div>
            {formError && <div role="alert" className="login-error"><p>{formError}</p><Link to={recoveryPath}>{th ? 'เข้าสู่ระบบด้วยบัญชีอื่น' : 'Sign in with another account'}</Link></div>}
            <form onSubmit={handleSubmit} className="login-form" aria-busy={submitting}>
                <div><label htmlFor="auth-username">{t('login.username')}</label><div className="login-input"><User size={18} aria-hidden="true" /><input id="auth-username" name="username" autoComplete="username" type="text" required placeholder={t('login.usernamePlaceholder')} onChange={handleChange} disabled={submitting} /></div></div>
                <div><label htmlFor="auth-password">{t('login.password')}</label><div className="login-input"><Lock size={18} aria-hidden="true" /><input id="auth-password" name="password" autoComplete="current-password" type={showPassword ? 'text' : 'password'} required placeholder={t('login.passwordPlaceholder')} onChange={handleChange} disabled={submitting} /><button className="login-password-toggle" type="button" aria-label={th ? (showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน') : (showPassword ? 'Hide password' : 'Show password')} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
                <button className="login-submit" type="submit" disabled={submitting}><LogIn size={18} aria-hidden="true" />{submitting ? (th ? 'กำลังดำเนินการ…' : 'Please wait…') : t('login.signIn')}</button>
            </form>
            <div className="login-offline">{offlineForm}</div>
            <p className="login-register">{t('login.noAccount')} <Link to="/register">{t('login.registerHere')}</Link></p>
        </section></main>
        <footer className="login-footer">© {new Date().getFullYear()} Volley Manager</footer>
    </div>;
}
