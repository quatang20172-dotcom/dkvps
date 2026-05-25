import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useServer } from '../contexts/ServerContext';
import { Server, Globe, HardDrive, Cpu, Activity, Wifi, WifiOff } from 'lucide-react';

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function ProgressBar({ value, color = 'primary' }) {
    const colors = { primary: 'bg-primary-500', green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500' };
    const barColor = value > 90 ? colors.red : value > 70 ? colors.yellow : colors[color];
    return (
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(value, 100)}%` }} />
        </div>
    );
}

export default function DashboardPage() {
    const { api, activeServer } = useServer();
    const { stats, connected } = useWebSocket();
    const [domains, setDomains] = useState([]);
    const [initial, setInitial] = useState(null);

    useEffect(() => {
        if (!api) return;
        api.get('/domains').then(r => setDomains(r.data.domains || [])).catch(() => {});
        api.get('/system/status').then(r => setInitial(r.data)).catch(() => {});
    }, [api]);

    const data = stats || initial;
    const cpuUsage = data?.cpu?.usage || 0;
    const memUsage = data?.memory?.total ? ((data.memory.used / data.memory.total) * 100) : 0;
    const diskUsage = data?.disk?.total ? ((data.disk.used / data.disk.total) * 100) : 0;

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Dashboard</h1>
                    <p className="text-sm text-gray-500">{activeServer?.name} - {activeServer?.url}</p>
                </div>
                <span className={`flex items-center text-sm ${connected ? 'text-green-600' : 'text-gray-400'}`}>
                    {connected ? <><Wifi className="w-4 h-4 mr-1" /> Live</> : <><WifiOff className="w-4 h-4 mr-1" /> Offline</>}
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="card p-5">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <p className="text-sm text-gray-500">CPU</p>
                            <p className="text-2xl font-bold">{cpuUsage.toFixed(1)}%</p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <Cpu className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                    <ProgressBar value={cpuUsage} color="primary" />
                </div>

                <div className="card p-5">
                    <div className="flex items-center justify-between mb-1">
                        <div>
                            <p className="text-sm text-gray-500">Memory</p>
                            <p className="text-2xl font-bold">{memUsage.toFixed(1)}%</p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <Activity className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{formatBytes(data?.memory?.used)} / {formatBytes(data?.memory?.total)}</p>
                    <ProgressBar value={memUsage} color="green" />
                </div>

                <div className="card p-5">
                    <div className="flex items-center justify-between mb-1">
                        <div>
                            <p className="text-sm text-gray-500">Disk</p>
                            <p className="text-2xl font-bold">{diskUsage.toFixed(1)}%</p>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <HardDrive className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{formatBytes(data?.disk?.used)} / {formatBytes(data?.disk?.total)}</p>
                    <ProgressBar value={diskUsage} color="primary" />
                </div>

                <div className="card p-5">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <p className="text-sm text-gray-500">Domains</p>
                            <p className="text-2xl font-bold">{domains.length}</p>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                            <Globe className="w-6 h-6 text-orange-600" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">{domains.filter(d => d.status === 'active').length} active</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card p-5">
                    <h3 className="text-lg font-semibold mb-4">Services</h3>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {data?.services && Object.entries(data.services).map(([name, status]) => (
                            <div key={name} className="flex items-center justify-between py-2">
                                <span className="text-sm capitalize">{name.replace('-', ' ')}</span>
                                <span className={status === 'active' ? 'badge-active' : 'badge-inactive'}>{status}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card p-5">
                    <h3 className="text-lg font-semibold mb-4">Server Info</h3>
                    <div className="space-y-3 text-sm">
                        {[
                            ['IP', data?.ip], ['Hostname', data?.hostname],
                            ['OS', data?.os], ['Uptime', data?.uptime],
                            ['CPU Cores', data?.cpu?.cores], ['Version', `v${data?.version || '1.0.0'}`]
                        ].map(([k, v]) => (
                            <div key={k} className="flex justify-between">
                                <span className="text-gray-500">{k}</span>
                                <span className="font-mono">{v || '-'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
