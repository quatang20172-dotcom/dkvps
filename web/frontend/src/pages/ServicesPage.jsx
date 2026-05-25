import React, { useState, useEffect } from 'react';
import { getServices, controlService } from '../utils/api';
import { Server, Play, Square, RotateCcw } from 'lucide-react';

export default function ServicesPage() {
    const [services, setServices] = useState({});
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState('');

    const load = () => {
        getServices()
            .then(r => setServices(r.data.services || {}))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleAction = async (service, action) => {
        setActionLoading(`${service}-${action}`);
        try {
            await controlService(service, action);
            setTimeout(load, 1000);
        } catch (e) {
            alert(e.response?.data?.error || 'Failed.');
        }
        setActionLoading('');
    };

    const serviceList = [
        { name: 'nginx', label: 'Nginx', desc: 'Web server' },
        { name: 'php-fpm', label: 'PHP-FPM', desc: 'PHP processor' },
        { name: 'mariadb', label: 'MariaDB', desc: 'Database server' },
        { name: 'redis', label: 'Redis', desc: 'Cache store' },
        { name: 'memcached', label: 'Memcached', desc: 'Memory cache' },
        { name: 'fail2ban', label: 'Fail2Ban', desc: 'Intrusion prevention' },
    ];

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Services</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {serviceList.map(svc => {
                    const status = services[svc.name] || 'unknown';
                    const isActive = status === 'active';

                    return (
                        <div key={svc.name} className="card p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center">
                                    <Server className={`w-5 h-5 mr-2 ${isActive ? 'text-green-500' : 'text-gray-400'}`} />
                                    <div>
                                        <h3 className="font-semibold">{svc.label}</h3>
                                        <p className="text-xs text-gray-500">{svc.desc}</p>
                                    </div>
                                </div>
                                <span className={isActive ? 'badge-active' : 'badge-inactive'}>{status}</span>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleAction(svc.name, 'start')}
                                    disabled={actionLoading === `${svc.name}-start`}
                                    className="btn-secondary flex-1 flex items-center justify-center text-xs py-1.5"
                                >
                                    <Play className="w-3 h-3 mr-1" /> Start
                                </button>
                                <button
                                    onClick={() => handleAction(svc.name, 'stop')}
                                    disabled={actionLoading === `${svc.name}-stop`}
                                    className="btn-secondary flex-1 flex items-center justify-center text-xs py-1.5"
                                >
                                    <Square className="w-3 h-3 mr-1" /> Stop
                                </button>
                                <button
                                    onClick={() => handleAction(svc.name, 'restart')}
                                    disabled={actionLoading === `${svc.name}-restart`}
                                    className="btn-primary flex-1 flex items-center justify-center text-xs py-1.5"
                                >
                                    <RotateCcw className="w-3 h-3 mr-1" /> Restart
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
