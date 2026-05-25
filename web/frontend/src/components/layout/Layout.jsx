import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useServer } from '../../contexts/ServerContext';
import {
    LayoutDashboard, Globe, Database, Server, Shield, Code2,
    Lock, HardDrive, Archive, Activity, Menu, X, ChevronDown, MonitorSmartphone
} from 'lucide-react';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/domains', icon: Globe, label: 'Domains' },
    { to: '/databases', icon: Database, label: 'Databases' },
    { to: '/services', icon: Server, label: 'Services' },
    { to: '/ssl', icon: Lock, label: 'SSL' },
    { to: '/php', icon: Code2, label: 'PHP' },
    { to: '/firewall', icon: Shield, label: 'Firewall' },
    { to: '/cache', icon: HardDrive, label: 'Cache' },
    { to: '/backup', icon: Archive, label: 'Backup' },
    { to: '/monitor', icon: Activity, label: 'Monitor' },
    { to: '/servers', icon: MonitorSmartphone, label: 'Servers' },
];

export default function Layout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { activeServer, servers, setActiveServerId } = useServer();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-800
                border-r border-gray-200 dark:border-gray-700 transform transition-transform
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                        <Server className="w-6 h-6 text-primary-600" />
                        <span className="text-lg font-bold text-gray-900 dark:text-white">MyVPS</span>
                    </div>
                    <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Server switcher */}
                {servers.length > 1 && (
                    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                        <select
                            value={activeServer?.id || ''}
                            onChange={e => setActiveServerId(e.target.value)}
                            className="w-full text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5"
                        >
                            {servers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <nav className="px-3 py-4 space-y-1 overflow-y-auto h-[calc(100vh-8rem)]">
                    {navItems.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) =>
                                `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                                ${isActive
                                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`
                            }
                        >
                            <item.icon className="w-5 h-5 mr-3 flex-shrink-0" />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 truncate">
                        {activeServer?.name} ({activeServer?.url})
                    </div>
                </div>
            </aside>

            <div className="lg:ml-64">
                <header className="sticky top-0 z-30 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4">
                    <button className="lg:hidden mr-4" onClick={() => setSidebarOpen(true)}>
                        <Menu className="w-6 h-6" />
                    </button>
                    <div className="flex-1" />
                    <span className="text-sm text-gray-500">MyVPS Dashboard</span>
                </header>

                <main className="p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
