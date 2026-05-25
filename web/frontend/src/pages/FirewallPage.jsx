import React, { useState, useEffect } from 'react';
import { useServer } from '../contexts/ServerContext';
import { Plus, X } from 'lucide-react';

export default function FirewallPage() {
    const { api } = useServer();
    const [status, setStatus] = useState(null);
    const [newPort, setNewPort] = useState('');

    const load = () => { api.get('/firewall/status').then(r => setStatus(r.data)).catch(() => {}); };
    useEffect(() => { if (api) load(); }, [api]);

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Firewall</h1>
            <div className="card p-5">
                <p className="mb-4">Status: <strong>{status?.state || 'N/A'}</strong></p>
                <div className="flex gap-3 mb-4">
                    <input type="text" value={newPort} onChange={e => setNewPort(e.target.value)} className="input w-40" placeholder="Port" />
                    <button onClick={async () => { if (!newPort) return; await api.post('/firewall/open', { port: newPort, protocol: 'tcp' }); setNewPort(''); load(); }}
                        className="btn-primary flex items-center"><Plus className="w-4 h-4 mr-1" /> Open</button>
                </div>
                <h4 className="text-sm font-semibold text-gray-500 mb-2">Open Ports</h4>
                <div className="flex flex-wrap gap-2">
                    {status?.ports?.map(p => (
                        <span key={p} className="inline-flex items-center px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 rounded-full text-sm">
                            {p}
                            <button onClick={async () => { if (!confirm(`Close ${p}?`)) return; await api.post('/firewall/close', { port: p.replace(/\/.*/, ''), protocol: 'tcp' }); load(); }}
                                className="ml-1 hover:text-red-500"><X className="w-3 h-3" /></button>
                        </span>
                    ))}
                    {(!status?.ports?.length) && <span className="text-sm text-gray-500">No custom ports</span>}
                </div>
            </div>
        </div>
    );
}
