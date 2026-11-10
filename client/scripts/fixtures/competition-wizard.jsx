import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider, useLanguage } from '../../src/context/LanguageContext';
import VisTheme from '../../src/components/vis/VisTheme';
import CompetitionWizard from '../../src/components/admin/CompetitionWizard';
import '../../src/index.css';
import '../../src/styles/AppTheme.css';
import '../../src/styles/AppThemeUtilities.css';
function Fixture() {
 const { setLanguage } = useLanguage();
 const [form,setForm] = useState({title_th:'',title_en:'',categories:[],max_sets:3,max_players:14,status:'open'});
 return <><div style={{position:'fixed',zIndex:60,top:0,left:0}}><button onClick={()=>setLanguage('THA')}>Fixture TH</button><button onClick={()=>setLanguage('ENG')}>Fixture EN</button></div><CompetitionWizard form={form} setForm={setForm} ageGroups={[{id:1,name:'U15'},{id:2,name:'U18'},{id:3,name:'ประชาชน'}]} stadiums={[{id:1,name:'สนามทดสอบ',name_en:'Test arena'}]} onClose={()=>{}} onLogo={()=>{}} onSubmit={(event)=>{event.preventDefault(); window.fixtureResult=form;}} /></>;
}
createRoot(document.getElementById('root')).render(<LanguageProvider><VisTheme><Fixture /></VisTheme></LanguageProvider>);
