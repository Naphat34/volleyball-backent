import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import LoginLayout from '../../components/auth/LoginLayout';
import { clearAuthSession, setAuthSession, getAccessSession } from '../../auth/authStorage';
import OfflineUnlock from '../../components/auth/OfflineUnlock';
import { loginIntent } from '../../offline/entryRouting';
import { resolveAccess, navigateAccess } from '../../offline/accessRouting';

export default function Login() {
  const { language, setLanguage, t } = useLanguage();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const attempt = useRef(false);
  const navigate = useNavigate();
  const { search } = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get('reauth') === '1' || params.get('vis-sync') === '1' || params.get('scorer-offline') === '1') return;
    let active = true;
    void resolveAccess({ search }).then(result => {
      if (!active) return;
      if (result.kind === 'ready') navigateAccess(navigate, result);
      else if (result.message) setFormError(result.message);
    }).catch(error => { if (active) setFormError(error.message); });
    return () => { active = false; };
  }, [navigate, search]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (attempt.current) return;
    attempt.current = true;
    setSubmitting(true);
    setFormError('');
    try {
      const response = await api.login({ username: formData.username, password: formData.password });
      const { user, token } = response.data;
      if (!['admin', 'score', 'scorer', 'statistician'].includes(user.role) && String(user.status || '').toLowerCase() !== 'active') {
        clearAuthSession();
        setFormError(t('login.pendingText'));
        return;
      }
      setAuthSession({ token, user });
      const result = await resolveAccess({ search }, getAccessSession());
      if (result.kind !== 'ready') { setFormError(result.message); return; }
      navigateAccess(navigate, result);
    } catch (err) {
      setFormError(err.response?.data?.error || err.message || t('login.failText'));
    } finally {
      attempt.current = false;
      setSubmitting(false);
    }
  };

  return <LoginLayout language={language} setLanguage={setLanguage} t={t}
    formError={formError} recoveryPath="/login?reauth=1"
    submitting={submitting} showPassword={showPassword} setShowPassword={setShowPassword}
    handleChange={handleChange} handleSubmit={handleSubmit}
    offlineForm={<OfflineUnlock compact section={loginIntent(search).section} disabled={submitting}
      beginAttempt={() => { if (attempt.current) return false; attempt.current = true; setSubmitting(true); return true; }}
      endAttempt={() => { attempt.current = false; setSubmitting(false); }}
      onUnlocked={async () => navigateAccess(navigate, await resolveAccess({ search }))} />}
  />;
}
