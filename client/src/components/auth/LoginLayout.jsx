import { Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import '../../pages/auth/Login.css';

export default function LoginLayout({ language, setLanguage, t, formError, recoveryPath, submitting,
    handleChange, handleSubmit, offlineForm }) {
    const th = language === 'THA';
    return <div className="login-page">
        <main className="login-main">
            <section className="login-card" aria-labelledby="login-title">
                <header className="login-card-header">
                    <h1 id="login-title">VIMS</h1>
                    <span className="login-status"><span aria-hidden="true" />Online Login</span>
                </header>
                <div className="login-card-body">
                    
                    {formError && <div role="alert" className="login-error"><p>{formError}</p><Link to={recoveryPath}>{th ? 'เข้าสู่ระบบด้วยบัญชีอื่น' : 'Sign in with another account'}</Link></div>}
                    <form onSubmit={handleSubmit} className="login-form" aria-busy={submitting}>
                        <div><label htmlFor="auth-username">Username</label><input id="auth-username" name="username" autoComplete="username" type="text" required onChange={handleChange} disabled={submitting} /></div>
                        <div><label htmlFor="auth-password">Password</label><input id="auth-password" name="password" autoComplete="current-password" type="password" required onChange={handleChange} disabled={submitting} /></div>
                        <button className="login-submit" type="submit" disabled={submitting}>{submitting ? (th ? 'กำลังเข้าสู่ระบบ…' : 'Signing in…') : (th ? 'เข้าสู่ระบบ' : 'Sign in')}</button>
                    </form>
                    <footer className="login-footer">VIMS · Volley Manager builder 20261103</footer>
                </div>
            </section>
        </main>
        <details className="login-settings">
            <summary aria-label={th ? 'ตั้งค่าการเข้าสู่ระบบ' : 'Login settings'}><Settings size={18} aria-hidden="true" /></summary>
            <div className="login-settings-panel">
                <div className="login-language" role="group" aria-label={th ? 'ภาษา' : 'Language'}>{[['THA', 'TH'], ['ENG', 'EN']].map(([value, text]) => <button type="button" key={value} aria-pressed={language === value} onClick={() => setLanguage(value)}>{text}</button>)}</div>
                <div className="login-offline">{offlineForm}</div>
                <p className="login-register">{t('login.noAccount')} <Link to="/register">{t('login.registerHere')}</Link></p>
            </div>
        </details>
    </div>;
}
