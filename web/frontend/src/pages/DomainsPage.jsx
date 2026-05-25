import React, { useState, useEffect } from 'react';
import { getDomains, addDomain, deleteDomain, suspendDomain, unsuspendDomain } from '../utils/api';
import { Globe, Plus, Trash2, PauseCircle, PlayCircle, Info } from 'lucide-react';

export default function DomainsPage() {
    const [domains, setDomains] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [newDomain, setNewDomain] = useState('');
    const [addLoading, setAddLoading] = useState(false);

    const loadDomains = () => {
        getDomains()
            .then(r => setDomains(r.data.domains || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadDomains(); }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newDomain) return;
        setAddLoading(true);
        try {
            await addDomain({ domain: newDomain });
            setNewDomain('');
            setShowAdd(false);
            loadDomains();
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to add domain.');
        }
        setAddLoading(false);
    };

    const handleDelete = async (domain) => {
        if (!confirm(`Delete domain ${domain} and ALL its data?`)) return;
        await deleteDomain(domain);
        loadDomains();
    };

    const handleSuspend = async (domain) => {
        await suspendDomain(domain);
        loadDomains();
    };

    const handleUnsuspend = async (domain) => {
        await unsuspendDomain(domain);
        loadDomains();
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Domains</h1>
                <button onClick={() => setShowAdd(!showAdd)} className="btn-primary flex items-center">
                    <Plus className="w-4 h-4 mr-1" /> Add Domain
                </button>
            </div>

            {/* Add form */}
            {showAdd && (
                <div className="card p-5 mb-6">
                    <h3 className="font-semibold mb-3">Add New Domain</h3>
                    <form onSubmit={handleAdd} className="flex gap-3">
                        <input type="text" value={newDomain} onChange={e => setNewDomain(e.target.value)}
                            className="input flex-1" placeholder="example.com" autoFocus />
                        <button type="submit" disabled={addLoading} className="btn-primary">
                            {addLoading ? 'Adding...' : 'Add'}
                        </button>
                        <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
                    </form>
                </div>
            )}

            {/* Domain list */}
            <div className="card overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Domain</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">PHP</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {loading ? (
                            <tr><td colSpan="6" className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
                        ) : domains.length === 0 ? (
                            <tr><td colSpan="6" className="px-5 py-8 text-center text-gray-500">No domains found.</td></tr>
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
                                    <span className={d.status === 'active' ? 'badge-active' : 'badge-warning'}>
                                        {d.status}
                                    </span>
                                </td>
                                <td className="px-5 py-4 text-sm text-gray-500">{d.created_at || '-'}</td>
                                <td className="px-5 py-4 text-right">
                                    <div className="flex items-center justify-end space-x-2">
                                        {d.status === 'active' ? (
                                            <button onClick={() => handleSuspend(d.domain)}
                                                className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded" title="Suspend">
                                                <PauseCircle className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button onClick={() => handleUnsuspend(d.domain)}
                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Unsuspend">
                                                <PlayCircle className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button onClick={() => handleDelete(d.domain)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
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
