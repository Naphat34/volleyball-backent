import { Component } from 'react';
import { useLocation } from 'react-router-dom';
import { Feedback } from './ui/SystemUI';

class Boundary extends Component {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error) { console.error('Unable to display page:', error); }
    render() {
        if (this.state.failed) return <main className="app-page flex min-h-screen items-center justify-center p-6"><Feedback error title="เปิดหน้านี้ไม่สำเร็จ / Unable to open this page" description="ลองโหลดหน้าใหม่ / Please reload and try again." onRetry={() => window.location.reload()} /></main>;
        return this.props.children;
    }
}

export default function PageBoundary({ children }) {
    const { pathname } = useLocation();
    return <Boundary key={pathname}>{children}</Boundary>;
}
