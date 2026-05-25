import React, { useState } from 'react';
import { useServer } from '../contexts/ServerContext';
import { Server, Plus, Wifi } from 'lucide-react';

export default function SetupPage() {
    const { addServer } = useServer();
    const [form, setForm] = useState({ name: '', url: '', apiKey: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Clean URL
        let url = form.url.trim().replace(/\/$/, '');
        if (!url.startsWith('http')) url = `https://${url}`;

        try {
            await addServer(form.name || 'My VPS', url, form.apiKey);
        } catch (e) {
            setError(e.response?.data?.error || e.message || 'Cannot connect to VPS agent');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-900 p-4">
            <div className="w-full max-w-lg">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4">
                        <Server className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">MyVPS Dashboard</h1>
                    <p className="text-primary-200 mt-2">Connect to your VPS to start managing</p>
                </div>

                <form onSubmit={handleSubmit} className="card p-8">
                    <h2 className="text-xl font-semibold mb-2">Connect VPS</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Enter your VPS agent URL and API key. The agent must be running on your VPS.
                    </p>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Server Name</label>
                            <input type="text" value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                className="input" placeholder="My VPS Server" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Agent URL</label>
                            <input type="text" value={form.url}
                                onChange={e => setForm({ ...form, url: e.target.value })}
                                className="input" placeholder="https://your-vps-ip:9090" required />
                            <p className="text-xs text-gray-500 mt-1">The URL where MyVPS Agent is running</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">API Key</label>
                            <input type="password" value={form.apiKey}
                                onChange={e => setForm({ ...form, apiKey: e.target.value })}
                                className="input font-mono" placeholder="Your API key" required />
                            <p className="text-xs text-gray-500 mt-1">
                                Generated during installation or via <code>myvps agent generate-key</code>
                            </p>
                        </div>

                        <button type="submit" disabled={loading}
                            className="btn-primary w-full py-2.5 flex items-center justify-center">
                            {loading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                                <><Wifi className="w-4 h-4 mr-2" /> Connect</>
                            )}
                        </button>
                    </div>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-primary-200 text-sm">
                        Need to install the agent? Run on your VPS:<br />
                        <code className="text-white bg-black/20 px-2 py-1 rounded mt-1 inline-block">
                            curl -sO https://yourdomain/install && bash install
                        </code>
                    </p>
                </div>
            </div>
        </div>
    );
}
