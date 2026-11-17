import './VolleyBrand.css';

export default function VolleyBrand({className='',tone='auto'}){
    return <span className={`volley-brand volley-brand--${tone} ${className}`}>
        <span className="volley-brand-mark" aria-hidden="true">
            <img className="volley-mark-light" src="/brand/volley-v-light.png" alt="" width="48" height="48"/>
            <img className="volley-mark-dark" src="/brand/volley-v-dark.png" alt="" width="48" height="48"/>
        </span>
        <span className="volley-brand-name">VOLLEY</span>
    </span>;
}
