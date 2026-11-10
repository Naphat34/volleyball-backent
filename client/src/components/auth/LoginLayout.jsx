import useUiTranslation from '../../hooks/useUiTranslation';
import { Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import '../../pages/auth/Login.css';

export default function LoginLayout({ language, setLanguage, t, formError, recoveryPath, submitting,
    handleChange, handleSubmit, offlineForm }) {
    const ui = useUiTranslation();
    const th = language === 'THA';
    return <div className="login-page">
        <main className="login-main">
            <section className="login-card" aria-labelledby="login-title">
                <header className="login-card-header">
                    <h1 id="login-title">{ui("VIMS")}</h1>
                    <span className="login-status"><span aria-hidden="true" />{ui("Online Login")}</span>
                </header>
                <div className="login-card-body">
                    
                    {formError && <div role="alert" className="login-error"><p>{formError}</p><Link to={recoveryPath}>{th ? ui('เข้าสู่ระบบด้วยบัญชีอื่น') : ui('Sign in with another account')}</Link></div>}
                    <form onSubmit={handleSubmit} className="login-form" aria-busy={submitting}>
                        <div><label htmlFor="auth-username">{ui("Username")}</label><input id="auth-username" name="username" autoComplete="username" type="text" required onChange={handleChange} disabled={submitting} /></div>
                        <div><label htmlFor="auth-password">{ui("Password")}</label><input id="auth-password" name="password" autoComplete="current-password" type="password" required onChange={handleChange} disabled={submitting} /></div>
                        <button className="login-submit" type="submit" disabled={submitting}>{submitting ? th ? ui('กำลังเข้าสู่ระบบ…') : ui('Signing in…') : th ? ui('เข้าสู่ระบบ') : ui('Sign in')}</button>
                    </form>
                    <footer className="login-footer">{ui("VIMS · Volley Manager builder 20261103")}</footer>
                </div>
            </section>
        </main>
        <details className="login-settings">
            <summary aria-label={th ? ui('ตั้งค่าการเข้าสู่ระบบ') : ui('Login settings')}><Settings size={18} aria-hidden="true" /></summary>
            <div className="login-settings-panel">
                <div className="login-language" role="group" aria-label={th ? ui('ภาษา') : ui('Language')}>{[['THA', 'TH'], ['ENG', 'EN']].map(([value, text]) => <button type="button" key={value} aria-pressed={language === value} onClick={() => setLanguage(value)}>{text}</button>)}</div>
                <div className="login-offline">{offlineForm}</div>
                <p className="login-register">{t('login.noAccount')} <Link to="/register">{t('login.registerHere')}</Link></p>
            </div>
        </details>
    </div>;
}
