import VisMatchSettings from './VisMatchSettings';
import VisStatsDialog from './VisStatsDialog';

export default function VisMatchDialog({ mode, ...props }) {
    return mode === 'settings' ? <VisMatchSettings {...props} /> : <VisStatsDialog {...props} />;
}
