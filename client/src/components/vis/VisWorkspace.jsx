import { useEffect, useRef, useState } from 'react';

export default function VisWorkspace({ children, showVideo, orientation, ratio, onRatio, reversed, onReverse }) {
    const container = useRef(null);
    const [source, setSource] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [error, setError] = useState('');
    const fileUrl = useRef(null);
    useEffect(() => () => { if (fileUrl.current) URL.revokeObjectURL(fileUrl.current); }, []);
    const youtube = (() => {
        try {
            const url = new URL(videoUrl);
            if (url.hostname === 'youtu.be') return url.pathname.slice(1);
            if (['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname)) return url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|live)\/([\w-]+)/)?.[1];
        } catch { /* Local files have blob URLs. */ }
        return null;
    })();
    const load = event => {
        event.preventDefault();
        try {
            const url = new URL(source);
            if (!['https:', 'http:'].includes(url.protocol)) throw Error();
            setVideoUrl(url.href); setError('');
        } catch { setError('กรุณาใส่ URL วิดีโอแบบ https:// หรือเลือกไฟล์'); }
    };
    const resize = event => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const rect = container.current.getBoundingClientRect();
        const position = orientation === 'row' ? (event.clientX - rect.left) / rect.width : (event.clientY - rect.top) / rect.height;
        onRatio(Math.max(20, Math.min(80, (reversed ? 1 - position : position) * 100)));
    };
    const heading = (title, type) => <div draggable onDragStart={event => event.dataTransfer.setData('text/vis-panel', type)}
        onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const from = event.dataTransfer.getData('text/vis-panel'); if (from && from !== type) onReverse(); }}
        className="shrink-0 cursor-grab border-b border-slate-700 bg-slate-800 px-3 py-1 text-[11px] text-slate-400" title="ลากหัวแผงไปยังอีกแผงเพื่อสลับตำแหน่ง">⠿ {title}</div>;
    const code = <div key="code" style={{ flex: showVideo ? `${ratio} 1 0%` : '1 1 0%' }} className="flex min-h-0 min-w-0 flex-col overflow-hidden">{showVideo && heading('Code · คีย์และประวัติ', 'code')}{children}</div>;
    const video = <div key="video" style={{ flex: `${100 - ratio} 1 0%` }} className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-black/30">
        {heading('Video · วิดีโอ', 'video')}
        <form onSubmit={load} className="flex shrink-0 flex-wrap gap-1 p-2"><input aria-label="URL วิดีโอ" value={source} onChange={event => setSource(event.target.value)} placeholder="YouTube / URL วิดีโอ" className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs" /><button className="rounded bg-sky-800 px-2 py-1 text-xs">เปิด</button>
            <label className="cursor-pointer rounded bg-slate-700 px-2 py-1 text-xs">ไฟล์<input className="sr-only" type="file" accept="video/*" onChange={event => {
                const file = event.target.files?.[0]; if (!file) return;
                if (fileUrl.current) URL.revokeObjectURL(fileUrl.current);
                fileUrl.current = URL.createObjectURL(file); setVideoUrl(fileUrl.current); setError('');
            }} /></label></form>
        {error && <p role="alert" className="px-2 text-xs text-amber-300">{error}</p>}
        <div className="flex min-h-0 flex-1 items-center justify-center p-2">
            {youtube ? <iframe title="วิดีโอประกอบการแข่งขัน" className="h-full w-full rounded" src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtube)}`} allow="fullscreen; picture-in-picture" allowFullScreen />
                : videoUrl ? <video key={videoUrl} src={videoUrl} controls className="max-h-full w-full" onError={() => setError('ไม่สามารถเล่นวิดีโอได้ ตรวจ URL และรูปแบบที่เบราว์เซอร์รองรับ')} />
                    : <p className="text-center text-xs text-slate-500">เปิดวิดีโอเพื่อดูคู่กับการคีย์<br />ลากหัวแผงเพื่อสลับ · ลากเส้นแบ่งเพื่อปรับขนาด</p>}
        </div>
    </div>;
    const divider = <div key="divider" role="separator" aria-label="ปรับขนาดแผง Code และ Video" aria-orientation={orientation === 'row' ? 'vertical' : 'horizontal'} tabIndex={0}
        aria-valuemin={20} aria-valuemax={80} aria-valuenow={Math.round(ratio)} onKeyDown={event => {
            if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) { event.preventDefault(); onRatio(Math.max(20, Math.min(80, ratio + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 5 : -5) * (reversed ? -1 : 1)))); }
        }} onPointerDown={event => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={resize} onPointerUp={event => event.currentTarget.releasePointerCapture(event.pointerId)}
        className={`shrink-0 touch-none bg-slate-700 hover:bg-sky-500 focus:bg-sky-500 ${orientation === 'row' ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize'}`} />;
    return <div ref={container} className={`flex min-h-0 flex-1 overflow-hidden ${orientation === 'row' ? 'flex-row' : 'flex-col'}`}>
        {showVideo ? reversed ? [video, divider, code] : [code, divider, video] : code}
    </div>;
}
