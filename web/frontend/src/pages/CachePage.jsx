import React, { useState, useEffect } from 'react';
import { getCacheStatus, flushRedis, resetOpcache, clearAllCache } from '../utils/api';
import { HardDrive, Trash2 } from 'lucide-react';

export default function CachePage() {
    const [status, setStatus] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getCacheStatus().then(r => setStatus(r.data)).catch(() => {});
    }, []);

    const handle = async (action, label) => {
        setLoading(true);
        try {
            await action();
            alert(`${label} done.`);
        } catch (e) {
            alert('Failed.');
        }
        setLoading(false);
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Cache Management</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="card p-5">
                    <h3 className="font-semibold mb-2">Redis</h3>
                    <span className={status.redis === 'active' ? 'badge-active' : 'badge-inactive'}>{status.redis || 'N/A'}</span>
                    <button onClick={() => handle(flushRedis, 'Redis flushed')} disabled={loading}
                        className="btn-danger w-full mt-3 flex items-center justify-center text-xs">
                        <Trash2 className="w-3 h-3 mr-1" /> Flush Redis
                    </button>
                </div>

                <div className="card p-5">
                    <h3 className="font-semibold mb-2">Memcached</h3>
                    <span className={status.memcached === 'active' ? 'badge-active' : 'badge-inactive'}>{status.memcached || 'N/A'}</span>
                </div>

                <div className="card p-5">
                    <h3 className="font-semibold mb-2">OPcache</h3>
                    <span className="badge-active">enabled</span>
                    <button onClick={() => handle(resetOpcache, 'OPcache reset')} disabled={loading}
                        className="btn-danger w-full mt-3 flex items-center justify-center text-xs">
                        <Trash2 className="w-3 h-3 mr-1" /> Reset OPcache
                    </button>
                </div>
            </div>

            <button onClick={() => handle(clearAllCache, 'All caches cleared')} disabled={loading}
                className="btn-danger flex items-center">
                <Trash2 className="w-4 h-4 mr-1" /> Clear All Caches
            </button>
        </div>
    );
}
