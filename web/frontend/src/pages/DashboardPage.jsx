import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { getStatus, getDomains } from '../utils/api';
import { Server, Globe, Database, HardDrive, Cpu, MemoryStick, Activity, Wifi, WifiOff } from 'lucide-react';

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function ProgressBar({ value, color = 'primary', label }) {
    const colors = {
        primary: 'bg-primary-500',
        green: 'bg-green-500',
        yellow: 'bg-yellow-500',
        red: 'bg-red-500'
    };
    const barColor = value > 90 ? colors.red : value > 70 ? colors.yellow : colors[color];

    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">{label}</span>
                <span className="font-medium">{value.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`}
                     style={{ width: `${Math.min(value, 100)}%` }} />
            </div>
        </div>
    );
}

function ServiceBadge({ name, status }) {
    const isActive = status === 'active';
    return (
        <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                {name.replace('-', ' ')}
            </span>
            <span className={isActive ? 'badge-active' : 'badge-inactive'}>
                {status}
            </span>
        </div>
    );
}

export default function DashboardPage() {
    const { stats, connected } = useWebSocket();
    const [domains, setDomains] = useState([]);
    const [initialStatus, setInitialStatus] = useState(null);

    useEffect(() => {
        getDomains().then(r => setDomains(r.data.domains || [])).catch(() => {});
        getStatus().then(r => setInitialStatus(r.data)).catch(() => {});
    }, []);

    const data = stats || initialStatus;

    const cpuUsage = data?.cpu?.usage || 0;
    const memUsage = data?.memory?.total ? ((data.memory.used / data.memory.total) * 100) : 0;
    const diskUsage = data?.disk?.total ? ((data.disk.used / data.disk.total) * 100) : 0;

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                <div className="flex items-center space-x-2">
                    {connected ? (
                        <span className="flex items-center text-sm text-green-600"><Wifi className="w-4 h-4 mr-1" /> Live</span>
                    ) : (
                        <span className="flex items-center text-sm text-gray-400"><WifiOff className="w-4 h-4 mr-1" /> Offline</span>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="card p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">CPU Usage</p>
                            <p className="text-2xl font-bold">{cpuUsage.toFixed(1)}%</p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <Cpu className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                    <ProgressBar value={cpuUsage} color="primary" label="" />
                </div>

                <div className="card p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Memory</p>
                            <p className="text-2xl font-bold">{memUsage.toFixed(1)}%</p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <Activity className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                    <div className="text-xs text-gray-500 mb-1">
                        {formatBytes(data?.memory?.used || 0)} / {formatBytes(data?.memory?.total || 0)}
                    </div>
                    <ProgressBar value={memUsage} color="green" label="" />
                </div>

                <div className="card p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Disk</p>
                            <p className="text-2xl font-bold">{diskUsage.toFixed(1)}%</p>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <HardDrive className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                    <div className="text-xs text-gray-500 mb-1">
                        {formatBytes(data?.disk?.used || 0)} / {formatBytes(data?.disk?.total || 0)}
                    </div>
                    <ProgressBar value={diskUsage} color="primary" label="" />
                </div>

                <div className="card p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Domains</p>
                            <p className="text-2xl font-bold">{domains.length}</p>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                            <Globe className="w-6 h-6 text-orange-600" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        {domains.filter(d => d.status === 'active').length} active
                    </p>
                </div>
            </div>

            {/* Services & Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card p-5">
                    <h3 className="text-lg font-semibold mb-4">Services</h3>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {data?.services && Object.entries(data.services).map(([name, status]) => (
                            <ServiceBadge key={name} name={name} status={status} />
                        ))}
                    </div>
                </div>

                <div className="card p-5">
                    <h3 className="text-lg font-semibold mb-4">Server Info</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">IP</span>
                            <span className="font-mono">{data?.ip || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Platform</span>
                            <span>{data?.platform || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Uptime</span>
                            <span>{data?.uptime || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Version</span>
                            <span>v{data?.version || '1.0.0'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">CPU Cores</span>
                            <span>{data?.cpu?.cores || '-'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
