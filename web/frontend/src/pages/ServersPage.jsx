import React, { useState, useEffect } from 'react';
import { useServer } from '../contexts/ServerContext';
import { Server, Plus, Trash2, Check, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import axios from 'axios';

export default function ServersPage() {
    const { servers, activeServerId, setActiveServerId, addServer, removeServer, refreshToken } = useServer();
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ name: '', url: '', apiKey: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [healthMap, setHealthMap] = useState({});

    // Check health of all servers
    useEffect(() => {
        servers.forEach(async (s) => {
            try {
                const res = await axios.get(`${s.url}/api/health`, { timeout: 5000 });
                setHealthMap(prev => ({ ...prev, [s.id]: { online: true, ...res.data } }));
            } catch {
                setHealthMap(prev => ({ ...prev, [s.id]: { online: false } }));
            }
        });
    }, [servers]);

    const handleAdd = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        let url = form.url.trim().replace(/\/$/, '');
        if (!url.startsWith('http')) url = `https://${url}`;

        try {
            await addServer(form.name || 'VPS', url, form.apiKey);
            setShowAdd(false);
            setForm({ name: '', url: '', apiKey: '' });
        } catch (e) {
            setError(e.response?.data?.error || e.message || 'Connection failed');
        }
        setLoading(false);
    };

    const handleRemove = (id, name) => {
        if (!confirm(`Remove server "${name}"?`)) return;
        removeServer(id);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">VPS Servers</h1>
                <button onClick={() => setShowAdd(!showAdd)} className="btn-primary flex items-center">
                    <Plus className="w-4 h-4 mr-1" /> Add Server
                </button>
            </div>

            {showAdd && (
                <div className="card p-5 mb-6">
                    <h3 className="font-semibold mb-3">Add New Server</h3>
                    {error && <div className="mb-3 p-2 bg-red-50 text-red-600 rounded text-sm">{error}</div>}
                    <form onSubmit={handleAdd} className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                                className="input" placeholder="Server name" />
                            <input type="text" value={form.url} onChange={e => setForm({...form, url: e.target.value})}
                                className="input" placeholder="https://ip:9090" required />
                            <input type="password" value={form.apiKey} onChange={e => setForm({...form, apiKey: e.target.value})}
                                className="input font-mono" placeholder="API key" required />
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" disabled={loading} className="btn-primary">
                                {loading ? 'Connecting...' : 'Connect'}
                            </button>
                            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {servers.map(server => {
                    const health = healthMap[server.id];
                    const isActive = server.id === activeServerId;

                    return (
                        <div key={server.id}
                            className={`card p-5 cursor-pointer transition-all ${
                                isActive ? 'ring-2 ring-primary-500' : 'hover:shadow-md'
                            }`}
                            onClick={() => setActiveServerId(server.id)}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center">
                                    <Server className={`w-5 h-5 mr-2 ${health?.online ? 'text-green-500' : 'text-gray-400'}`} />
                                    <h3 className="font-semibold">{server.name}</h3>
                                </div>
                                <div className="flex items-center gap-1">
                                    {isActive && <Check className="w-4 h-4 text-primary-500" />}
                                    {health?.online
                                        ? <Wifi className="w-4 h-4 text-green-500" />
                                        : <WifiOff className="w-4 h-4 text-red-500" />
                                    }
                                </div>
                            </div>

                            <div className="text-sm text-gray-500 space-y-1 mb-3">
                                <p className="font-mono text-xs">{server.url}</p>
                                {health?.online && (
                                    <>
                                        <p>Hostname: {health.hostname}</p>
                                        <p>Version: v{health.version}</p>
                                    </>
                                )}
                            </div>

                            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                <button onClick={() => refreshToken(server.id)}
                                    className="btn-secondary flex-1 text-xs py-1.5 flex items-center justify-center">
                                    <RefreshCw className="w-3 h-3 mr-1" /> Refresh Token
                                </button>
                                <button onClick={() => handleRemove(server.id, server.name)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
