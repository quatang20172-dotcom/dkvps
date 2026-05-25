import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { logout } from '../../utils/api';
import {
    LayoutDashboard, Globe, Database, Server, Shield, Code2,
    Lock, HardDrive, Archive, Activity, Menu, X, LogOut, ChevronDown
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
];

export default function Layout({ children, user, onLogout }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        onLogout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                     onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-800
                border-r border-gray-200 dark:border-gray-700 transform transition-transform
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                {/* Logo */}
                <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                        <Server className="w-6 h-6 text-primary-600" />
                        <span className="text-lg font-bold text-gray-900 dark:text-white">MyVPS</span>
                    </div>
                    <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Nav */}
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

                {/* User */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
                    <button onClick={handleLogout}
                        className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout ({user?.username})
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div className="lg:ml-64">
                {/* Top bar */}
                <header className="sticky top-0 z-30 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4">
                    <button className="lg:hidden mr-4" onClick={() => setSidebarOpen(true)}>
                        <Menu className="w-6 h-6" />
                    </button>
                    <div className="flex-1" />
                    <span className="text-sm text-gray-500">MyVPS v1.0.0</span>
                </header>

                {/* Page content */}
                <main className="p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
