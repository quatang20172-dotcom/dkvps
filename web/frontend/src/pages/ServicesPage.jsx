import React, { useState, useEffect } from 'react';
import { useServer } from '../contexts/ServerContext';
import { Server, Play, Square, RotateCcw } from 'lucide-react';

const SERVICE_LIST = [
    { name: 'nginx', label: 'Nginx', desc: 'Web server' },
    { name: 'php-fpm', label: 'PHP-FPM', desc: 'PHP processor' },
    { name: 'mariadb', label: 'MariaDB', desc: 'Database server' },
    { name: 'redis', label: 'Redis', desc: 'Cache store' },
    { name: 'memcached', label: 'Memcached', desc: 'Memory cache' },
    { name: 'fail2ban', label: 'Fail2Ban', desc: 'Intrusion prevention' },
];

export default function ServicesPage() {
    const { api } = useServer();
    const [services, setServices] = useState({});
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');

    const load = () => {
        api.get('/services').then(r => setServices(r.data.services || {})).catch(() => {}).finally(() => setLoading(false));
    };
    useEffect(() => { if (api) load(); }, [api]);

    const act = async (name, action) => {
        setBusy(`${name}-${action}`);
        try { await api.post(`/services/${name}/${action}`); setTimeout(load, 1000); }
        catch (e) { alert(e.response?.data?.error || 'Failed'); }
        setBusy('');
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Services</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {SERVICE_LIST.map(svc => {
                    const status = services[svc.name] || 'unknown';
                    const isActive = status === 'active';
                    return (
                        <div key={svc.name} className="card p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center">
                                    <Server className={`w-5 h-5 mr-2 ${isActive ? 'text-green-500' : 'text-gray-400'}`} />
                                    <div><h3 className="font-semibold">{svc.label}</h3><p className="text-xs text-gray-500">{svc.desc}</p></div>
                                </div>
                                <span className={isActive ? 'badge-active' : 'badge-inactive'}>{status}</span>
                            </div>
                            <div className="flex gap-2">
                                {['start', 'stop', 'restart'].map(a => (
                                    <button key={a} onClick={() => act(svc.name, a)} disabled={busy === `${svc.name}-${a}`}
                                        className={`${a === 'restart' ? 'btn-primary' : 'btn-secondary'} flex-1 text-xs py-1.5 flex items-center justify-center`}>
                                        {a === 'start' ? <Play className="w-3 h-3 mr-1" /> :
                                         a === 'stop' ? <Square className="w-3 h-3 mr-1" /> :
                                         <RotateCcw className="w-3 h-3 mr-1" />}
                                        {a.charAt(0).toUpperCase() + a.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
