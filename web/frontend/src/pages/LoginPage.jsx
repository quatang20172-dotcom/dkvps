import React, { useState } from 'react';
import { login } from '../utils/api';
import { Server, Lock, User } from 'lucide-react';

export default function LoginPage({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await login(username, password);
            onLogin(res.data.user);
        } catch (e) {
            setError(e.response?.data?.error || 'Login failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-900 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4">
                        <Server className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">MyVPS</h1>
                    <p className="text-primary-200 mt-1">VPS Management Dashboard</p>
                </div>

                <form onSubmit={handleSubmit} className="card p-8">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Sign In</h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                                    className="input pl-10" placeholder="admin" autoFocus />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                                    className="input pl-10" placeholder="Password" />
                            </div>
                        </div>

                        <button type="submit" disabled={loading}
                            className="btn-primary w-full py-2.5 flex items-center justify-center">
                            {loading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : 'Sign In'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
