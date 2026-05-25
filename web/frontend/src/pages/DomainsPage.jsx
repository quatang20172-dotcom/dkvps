import React, { useState, useEffect } from 'react';
import { useServer } from '../contexts/ServerContext';
import { Globe, Plus, Trash2, PauseCircle, PlayCircle } from 'lucide-react';

export default function DomainsPage() {
    const { api } = useServer();
    const [domains, setDomains] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [newDomain, setNewDomain] = useState('');
    const [addLoading, setAddLoading] = useState(false);

    const load = () => {
        api.get('/domains')
            .then(r => setDomains(r.data.domains || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { if (api) load(); }, [api]);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newDomain) return;
        setAddLoading(true);
        try {
            await api.post('/domains', { domain: newDomain });
            setNewDomain('');
            setShowAdd(false);
            load();
        } catch (e) {
            alert(e.response?.data?.error || 'Failed');
        }
        setAddLoading(false);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Domains</h1>
                <button onClick={() => setShowAdd(!showAdd)} className="btn-primary flex items-center">
                    <Plus className="w-4 h-4 mr-1" /> Add Domain
                </button>
            </div>

            {showAdd && (
                <div className="card p-5 mb-6">
                    <form onSubmit={handleAdd} className="flex gap-3">
                        <input type="text" value={newDomain} onChange={e => setNewDomain(e.target.value)}
                            className="input flex-1" placeholder="example.com" autoFocus />
                        <button type="submit" disabled={addLoading} className="btn-primary">{addLoading ? 'Adding...' : 'Add'}</button>
                        <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
                    </form>
                </div>
            )}

            <div className="card overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Domain</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">PHP</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {loading ? (
                            <tr><td colSpan="5" className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
                        ) : domains.length === 0 ? (
                            <tr><td colSpan="5" className="px-5 py-8 text-center text-gray-500">No domains</td></tr>
                        ) : domains.map(d => (
                            <tr key={d.domain} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                <td className="px-5 py-4">
                                    <div className="flex items-center">
                                        <Globe className="w-4 h-4 text-primary-500 mr-2" />
                                        <span className="font-medium">{d.domain}</span>
                                    </div>
                                </td>
                                <td className="px-5 py-4 text-sm text-gray-500">{d.username}</td>
                                <td className="px-5 py-4 text-sm">{d.php_version}</td>
                                <td className="px-5 py-4">
                                    <span className={d.status === 'active' ? 'badge-active' : 'badge-warning'}>{d.status}</span>
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <div className="flex items-center justify-end space-x-2">
                                        {d.status === 'active' ? (
                                            <button onClick={async () => { await api.post(`/domains/${d.domain}/suspend`); load(); }}
                                                className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded" title="Suspend">
                                                <PauseCircle className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button onClick={async () => { await api.post(`/domains/${d.domain}/unsuspend`); load(); }}
                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Unsuspend">
                                                <PlayCircle className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button onClick={async () => {
                                            if (!confirm(`Delete ${d.domain}?`)) return;
                                            await api.delete(`/domains/${d.domain}`);
                                            load();
                                        }} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
