import React from 'react';
import {createRoot} from 'react-dom/client';
import {LanguageProvider,useLanguage} from '../../src/context/LanguageContext';
import HomeTab from '../../src/components/admin/HomeTab';
import client from '../../src/api';
import '../../src/index.css';
import '../../src/styles/AppTheme.css';
const competitions=[{id:1,title:'ชื่อรายการเดิม (Male)',title_th:'ชื่อรายการภาษาไทย',title_en:'Registered Championship',gender:'Male',status:'open'}, {id:2,title:'ชื่อรายการเดิม (Female)',title_th:'ชื่อรายการภาษาไทย',title_en:'Registered Championship',gender:'Female',status:'open'}];
client.defaults.adapter=async config=>({config,status:200,statusText:'OK',headers:{},data:config.url==='/admin/competitions'?competitions:[]});
function Fixture(){ const {setLanguage}=useLanguage();return <><nav><button onClick={()=>setLanguage('THA')}>Fixture TH</button><button onClick={()=>setLanguage('ENG')}>Fixture EN</button></nav><main style={{padding:32}}><HomeTab /></main></>; }
createRoot(document.getElementById('root')).render(<LanguageProvider><Fixture /></LanguageProvider>);
