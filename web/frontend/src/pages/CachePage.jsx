import React, { useState, useEffect } from 'react';
import { useServer } from '../contexts/ServerContext';
import { Trash2 } from 'lucide-react';

export default function CachePage() {
    const { api } = useServer();
    const [status, setStatus] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => { if (api) api.get('/cache/status').then(r => setStatus(r.data)).catch(() => {}); }, [api]);

    const act = async (path, label) => {
        setLoading(true);
        try { await api.post(path); alert(`${label} done`); } catch { alert('Failed'); }
        setLoading(false);
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Cache</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="card p-5">
                    <h3 className="font-semibold mb-2">Redis</h3>
                    <span className={status.redis === 'active' ? 'badge-active' : 'badge-inactive'}>{status.redis || 'N/A'}</span>
                    <button onClick={() => act('/cache/redis/flush', 'Redis flushed')} disabled={loading}
                        className="btn-danger w-full mt-3 text-xs flex items-center justify-center"><Trash2 className="w-3 h-3 mr-1" /> Flush</button>
                </div>
                <div className="card p-5">
                    <h3 className="font-semibold mb-2">Memcached</h3>
                    <span className={status.memcached === 'active' ? 'badge-active' : 'badge-inactive'}>{status.memcached || 'N/A'}</span>
                </div>
                <div className="card p-5">
                    <h3 className="font-semibold mb-2">OPcache</h3>
                    <span className="badge-active">enabled</span>
                    <button onClick={() => act('/cache/opcache/reset', 'OPcache reset')} disabled={loading}
                        className="btn-danger w-full mt-3 text-xs flex items-center justify-center"><Trash2 className="w-3 h-3 mr-1" /> Reset</button>
                </div>
            </div>
            <button onClick={() => act('/cache/clear-all', 'All cleared')} disabled={loading}
                className="btn-danger flex items-center"><Trash2 className="w-4 h-4 mr-1" /> Clear All</button>
        </div>
    );
}
