import React, { useState, useEffect } from 'react';
import { getCertificates, installSSL, renewSSL, getDomains } from '../utils/api';
import { Lock, Plus, RefreshCw } from 'lucide-react';

export default function SSLPage() {
    const [certs, setCerts] = useState('');
    const [domains, setDomains] = useState([]);
    const [selectedDomain, setSelectedDomain] = useState('');
    const [provider, setProvider] = useState('letsencrypt');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getCertificates().then(r => setCerts(r.data.certificates || '')).catch(() => {});
        getDomains().then(r => setDomains(r.data.domains || [])).catch(() => {});
    }, []);

    const handleInstall = async () => {
        if (!selectedDomain) return;
        setLoading(true);
        try {
            await installSSL(selectedDomain, provider);
            alert(`SSL installed for ${selectedDomain}`);
            getCertificates().then(r => setCerts(r.data.certificates || ''));
        } catch (e) {
            alert(e.response?.data?.error || 'Failed.');
        }
        setLoading(false);
    };

    const handleRenew = async () => {
        setLoading(true);
        try {
            await renewSSL();
            alert('All certificates renewed.');
        } catch (e) {
            alert('Renewal failed.');
        }
        setLoading(false);
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">SSL Certificates</h1>

            <div className="card p-5 mb-6">
                <h3 className="font-semibold mb-3">Install SSL</h3>
                <div className="flex gap-3 flex-wrap">
                    <select value={selectedDomain} onChange={e => setSelectedDomain(e.target.value)} className="input w-auto">
                        <option value="">Select domain...</option>
                        {domains.map(d => <option key={d.domain} value={d.domain}>{d.domain}</option>)}
                    </select>
                    <select value={provider} onChange={e => setProvider(e.target.value)} className="input w-auto">
                        <option value="letsencrypt">Let's Encrypt</option>
                        <option value="zerossl">ZeroSSL</option>
                    </select>
                    <button onClick={handleInstall} disabled={loading || !selectedDomain} className="btn-primary flex items-center">
                        <Lock className="w-4 h-4 mr-1" /> Install SSL
                    </button>
                    <button onClick={handleRenew} disabled={loading} className="btn-secondary flex items-center">
                        <RefreshCw className="w-4 h-4 mr-1" /> Renew All
                    </button>
                </div>
            </div>

            <div className="card p-5">
                <h3 className="font-semibold mb-3">Certificates</h3>
                <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                    {certs || 'No certificates found. Install acme.sh first.'}
                </pre>
            </div>
        </div>
    );
}
