import React, { useState, useEffect } from 'react';
import { useServer } from '../contexts/ServerContext';

export default function PHPPage() {
    const { api } = useServer();
    const [info, setInfo] = useState(null);
    const [changing, setChanging] = useState(false);

    useEffect(() => { if (api) api.get('/php/info').then(r => setInfo(r.data)).catch(() => {}); }, [api]);

    const change = async (v) => {
        if (!confirm(`Switch to PHP ${v}?`)) return;
        setChanging(true);
        try { await api.post('/php/version', { version: v }); alert(`PHP ${v}`); api.get('/php/info').then(r => setInfo(r.data)); }
        catch { alert('Failed'); }
        setChanging(false);
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">PHP Management</h1>
            <div className="card p-5 mb-6">
                <h3 className="font-semibold mb-2">Current Version</h3>
                <p className="font-mono">{info?.version || 'Loading...'}</p>
            </div>
            <div className="card p-5 mb-6">
                <h3 className="font-semibold mb-3">Change Version</h3>
                <div className="flex gap-2 flex-wrap">
                    {['7.4','8.0','8.1','8.2','8.3'].map(v => (
                        <button key={v} onClick={() => change(v)} disabled={changing} className="btn-secondary">PHP {v}</button>
                    ))}
                </div>
            </div>
            <div className="card p-5">
                <h3 className="font-semibold mb-3">Modules ({info?.modules?.length || 0})</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-1">
                    {info?.modules?.map(m => <span key={m} className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded">{m}</span>)}
                </div>
            </div>
        </div>
    );
}
