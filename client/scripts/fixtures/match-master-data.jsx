import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LanguageProvider} from '../../src/context/LanguageContext';
import ScorerMatchModal from '../../src/components/scorer/ScorerMatchModal';
import '../../src/index.css';
import '../../src/styles/AppTheme.css';
function Fixture(){
    const [open,setOpen]=useState(true);
    const id=new URLSearchParams(location.search).get('matchId');
    return <LanguageProvider><button onClick={()=>setOpen(true)}>Open settings</button>{open&&<ScorerMatchModal source={{id}} onClose={()=>setOpen(false)}/>}</LanguageProvider>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
