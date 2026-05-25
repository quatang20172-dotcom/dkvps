import React, { useState, useEffect } from 'react';
import { useServer } from '../contexts/ServerContext';
import { Lock, RefreshCw } from 'lucide-react';

export default function SSLPage() {
    const { api } = useServer();
    const [certs, setCerts] = useState('');
    const [domains, setDomains] = useState([]);
    const [domain, setDomain] = useState('');
    const [provider, setProvider] = useState('letsencrypt');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!api) return;
        api.get('/ssl').then(r => setCerts(r.data.certificates || '')).catch(() => {});
        api.get('/domains').then(r => setDomains(r.data.domains || [])).catch(() => {});
    }, [api]);

    const install = async () => {
        if (!domain) return;
        setLoading(true);
        try { await api.post('/ssl/install', { domain, provider }); alert(`SSL installed for ${domain}`);
            api.get('/ssl').then(r => setCerts(r.data.certificates || '')); } catch (e) { alert(e.response?.data?.error || 'Failed'); }
        setLoading(false);
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">SSL Certificates</h1>
            <div className="card p-5 mb-6">
                <div className="flex gap-3 flex-wrap">
                    <select value={domain} onChange={e => setDomain(e.target.value)} className="input w-auto">
                        <option value="">Select domain...</option>
                        {domains.map(d => <option key={d.domain} value={d.domain}>{d.domain}</option>)}
                    </select>
                    <select value={provider} onChange={e => setProvider(e.target.value)} className="input w-auto">
                        <option value="letsencrypt">Let's Encrypt</option>
                        <option value="zerossl">ZeroSSL</option>
                    </select>
                    <button onClick={install} disabled={loading || !domain} className="btn-primary flex items-center">
                        <Lock className="w-4 h-4 mr-1" /> Install SSL
                    </button>
                    <button onClick={async () => { setLoading(true); await api.post('/ssl/renew').catch(() => {}); setLoading(false); }}
                        disabled={loading} className="btn-secondary flex items-center">
                        <RefreshCw className="w-4 h-4 mr-1" /> Renew All
                    </button>
                </div>
            </div>
            <div className="card p-5">
                <h3 className="font-semibold mb-3">Certificates</h3>
                <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                    {certs || 'No certificates found.'}
                </pre>
            </div>
        </div>
    );
}
