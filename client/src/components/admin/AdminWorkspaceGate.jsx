import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import './AdminWorkspace.css';

// Check the current server identity before rendering administration controls.
export default function AdminWorkspaceGate({roles,children}){
    const [state,setState]=useState('checking'),[attempt,setAttempt]=useState(0);
    const roleKey=roles.join(',');
    useEffect(()=>{
        let active=true;
        const check=async()=>{try{const response=await api.accessSession();if(active)setState(roleKey.split(',').includes(response.data.role)?'ready':'denied');}
            catch(error){if(active)setState([401,403].includes(error.response?.status)?'denied':'error');}};
        void check();window.addEventListener('focus',check);
        return()=>{active=false;window.removeEventListener('focus',check);};
    },[roleKey,attempt]);
    if(state==='ready')return children;
    return <main className="app-page min-h-screen p-6"><section className="aw-denied" role={state==='checking'?'status':'alert'}>
        <h1>{state==='checking'?'กำลังตรวจสิทธิ์พื้นที่ทำงาน':state==='denied'?'คุณไม่มีสิทธิ์เข้าพื้นที่นี้':'ไม่สามารถตรวจสิทธิ์ได้'}</h1>
        <p>{state==='checking'?'กรุณารอสักครู่':state==='denied'?'โปรดเข้าสู่ระบบด้วยบัญชีที่มีบทบาทตรงกับพื้นที่ทำงาน':'ตรวจการเชื่อมต่อแล้วลองอีกครั้ง'}</p>
        {state!=='checking'&&<><Link to="/login?reauth=1">เข้าสู่ระบบ</Link><button onClick={()=>setAttempt(value=>value+1)}>ตรวจสิทธิ์อีกครั้ง</button></>}
    </section></main>;
}
