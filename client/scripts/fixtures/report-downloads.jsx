import React from 'react';
import {createRoot} from 'react-dom/client';
import {LanguageProvider} from '../../src/context/LanguageContext';
import AdminReportCenter from '../../src/components/admin/AdminReportCenter';
import client from '../../src/api';
import '../../src/index.css';
import '../../src/styles/AppTheme.css';
sessionStorage.setItem('token','fixture-admin-token');
localStorage.setItem('language','ENG');
window.reportRequests=[];
client.defaults.adapter=async config=>{
 window.reportRequests.push({url:config.url,authorization:config.headers.get('Authorization')});
 if(window.reportDenied) throw {response:{status:403,data:new Blob([JSON.stringify({error:'Insufficient permissions'})],{type:'application/json'})},config};
 const excel=config.url.endsWith('.xls');
 return {config,status:200,statusText:'OK',headers:{},data:new Blob([excel?'<html><meta charset="utf-8"><table><tr><td>ทีมทดสอบ</td></tr></table></html>':'\uFEFFid,name\n1,ทีมทดสอบ'],{type:excel?'application/vnd.ms-excel':'text/csv'})};
};
createRoot(document.getElementById('root')).render(<LanguageProvider><AdminReportCenter onNavigate={()=>{}} /></LanguageProvider>);
