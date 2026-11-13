import { useLayoutEffect, useRef } from 'react';
import './ScoresheetRoster.css';

function FitName({ text = '', maxFont = 13 }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const element = ref.current;
        const textElement = element.firstElementChild;
        let disposed = false;
        const fit = () => {
            if (disposed) return;
            textElement.style.fontSize = `${maxFont}px`;
            const width = Math.max(1, element.clientWidth - 6);
            const naturalWidth = Math.max(1, textElement.scrollWidth);
            textElement.style.fontSize = `${Math.max(1, Math.min(maxFont, element.clientHeight * 0.66, maxFont * width / naturalWidth))}px`;
        };
        const observer = new ResizeObserver(fit);
        observer.observe(element);
        window.addEventListener('beforeprint', fit);
        window.addEventListener('afterprint', fit);
        document.fonts?.ready.then(fit);
        fit();
        return () => { disposed = true; observer.disconnect(); window.removeEventListener('beforeprint', fit); window.removeEventListener('afterprint', fit); };
    }, [text, maxFont]);
    return <div ref={ref} className="ss-roster-name" title={text}><span>{text}</span></div>;
}

export default function ScoresheetRoster({ roster, teamA, teamB, officials, signatures = {}, personName, playerNumber, ui = text => text }) {
    const captain = player => [player?.isCaptain, player?.is_captain].some(value => [true, 1, '1', 'true'].includes(value));
    const rows = (players, count, side, libero = false) => <div className="ss-roster-player-list" style={{ gridTemplateRows: `repeat(${count}, minmax(0, 1fr))` }}>
        {Array.from({ length: count }, (_, index) => {
            const player = players[index];
            return <div key={index} className={`ss-roster-player-row${player ? '' : ' ss-roster-empty'}`} data-roster-row={player ? (libero ? 'libero' : 'regular') : undefined} data-side={side}>
                {player && <><div className="ss-roster-number"><span className={captain(player) ? 'ss-roster-captain' : undefined}>{playerNumber(player)}</span></div><FitName text={personName(player)} /></>}
            </div>;
        })}
    </div>;
    return <section className={`scoresheet-roster${roster.capacity > 14 ? ' ss-roster-compact' : ''}`} data-capacity={roster.capacity}>
        <header className="ss-roster-heading">
            <span className="ss-roster-choice"><span className="ss-roster-chosen">A</span><span>{ui('or')}</span><span>B</span></span>
            <span className="ss-roster-team-marker">A</span><FitName text={teamA} maxFont={11}/>
            <strong>{ui('TEAMS')}<small>{ui('vs')}</small></strong>
            <FitName text={teamB} maxFont={11}/><span className="ss-roster-team-marker">B</span>
            <span className="ss-roster-choice"><span>A</span><span>{ui('or')}</span><span className="ss-roster-chosen">B</span></span>
        </header>
        <div className="ss-roster-columns ss-roster-column-head">{['A', 'B'].map(side => <div className="ss-roster-player-row" key={side}><span className="ss-roster-number">{ui('No.')}</span><span className="ss-roster-name-heading">{ui('Name of the player')}</span></div>)}</div>
        <div className="ss-roster-columns ss-roster-regular">{rows(roster.playersA, roster.regularRows, 'A')}{rows(roster.playersB, roster.regularRows, 'B')}</div>
        <h4>{ui('LIBERO PLAYERS ("L")')}</h4>
        <div className="ss-roster-columns ss-roster-liberos" style={{ height: `calc(${roster.liberoRows} * var(--ss-libero-height))` }}>{rows(roster.liberosA, roster.liberoRows, 'A', true)}{rows(roster.liberosB, roster.liberoRows, 'B', true)}</div>
        <h4>{ui('OFFICIALS')}</h4>
        <div className="ss-roster-officials">{officials.map(item => <div className="ss-roster-official-row" key={item.r}><FitName text={item.nameA || ''} maxFont={11}/><strong>{item.r}</strong><FitName text={item.nameB || ''} maxFont={11}/></div>)}</div>
        <h4>{ui('SIGNATURES')}</h4>
        <div className="ss-roster-columns ss-roster-signatures">{['A', 'B'].map(side => <div key={side}>{[['captain', 'Team Captain:'], ['coach', 'Coach:']].map(([role, label]) => <div className="ss-roster-signature" key={role}>{signatures[`${role}${side}`] && <img src={signatures[`${role}${side}`]} alt={`${role} ${side}`}/>}<span>{ui(label)}</span></div>)}</div>)}</div>
    </section>;
}
