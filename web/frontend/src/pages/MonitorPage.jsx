import React, { useState, useEffect } from 'react';
import { useServer } from '../contexts/ServerContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { Activity, HardDrive, ScrollText } from 'lucide-react';

function formatBytes(b) {
    if (!b) return '0 B';
    const k = 1024, s = ['B','KB','MB','GB','TB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
}

export default function MonitorPage() {
    const { api } = useServer();
    const { stats } = useWebSocket();
    const [processes, setProcesses] = useState([]);
    const [disks, setDisks] = useState([]);
    const [tab, setTab] = useState('overview');

    useEffect(() => {
        if (!api) return;
        api.get('/system/processes').then(r => setProcesses(r.data.processes || [])).catch(() => {});
        api.get('/system/disk').then(r => setDisks(r.data.disks || [])).catch(() => {});
    }, [api]);

    const tabs = [
        { id: 'overview', label: 'Overview', icon: Activity },
        { id: 'disk', label: 'Disk', icon: HardDrive },
    ];

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">System Monitor</h1>
            <div className="flex gap-2 mb-6">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium ${
                            tab === t.id ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                        <t.icon className="w-4 h-4 mr-1.5" /> {t.label}
                    </button>
                ))}
            </div>

            {tab === 'overview' && (
                <div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="card p-5">
                            <h3 className="text-sm text-gray-500 mb-1">CPU</h3>
                            <p className="text-3xl font-bold">{stats?.cpu?.usage?.toFixed(1) || 0}%</p>
                            <p className="text-xs text-gray-500 mt-1">{stats?.cpu?.cores || '-'} cores</p>
                        </div>
                        <div className="card p-5">
                            <h3 className="text-sm text-gray-500 mb-1">Memory</h3>
                            <p className="text-3xl font-bold">{stats?.memory ? ((stats.memory.used/stats.memory.total*100).toFixed(1)) : 0}%</p>
                            <p className="text-xs text-gray-500 mt-1">{formatBytes(stats?.memory?.used)} / {formatBytes(stats?.memory?.total)}</p>
                        </div>
                        <div className="card p-5">
                            <h3 className="text-sm text-gray-500 mb-1">Disk</h3>
                            <p className="text-3xl font-bold">{stats?.disk?.usage || '0%'}</p>
                            <p className="text-xs text-gray-500 mt-1">{formatBytes(stats?.disk?.used)} / {formatBytes(stats?.disk?.total)}</p>
                        </div>
                    </div>
                    <div className="card p-5">
                        <h3 className="font-semibold mb-3">Top Processes</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-gray-500 uppercase">
                                        <th className="py-2">PID</th><th>User</th><th>CPU%</th><th>MEM%</th><th>Command</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {processes.map((p, i) => (
                                        <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                                            <td className="py-1.5 font-mono">{p.pid}</td><td>{p.user}</td>
                                            <td>{p.cpu}%</td><td>{p.mem}%</td><td className="truncate max-w-xs">{p.command}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'disk' && (
                <div className="card p-5">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-gray-500 uppercase">
                                <th className="py-2">Filesystem</th><th>Total</th><th>Used</th><th>Available</th><th>Usage</th><th>Mount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {disks.map((d, i) => (
                                <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                                    <td className="py-1.5 font-mono">{d.filesystem}</td>
                                    <td>{formatBytes(d.total)}</td><td>{formatBytes(d.used)}</td>
                                    <td>{formatBytes(d.available)}</td><td>{d.usage}</td><td>{d.mount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
