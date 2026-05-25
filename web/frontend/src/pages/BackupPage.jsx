import React, { useState, useEffect } from 'react';
import { useServer } from '../contexts/ServerContext';
import { Archive, Trash2 } from 'lucide-react';

function formatSize(b) {
    if (!b) return '0 B';
    const k = 1024, s = ['B','KB','MB','GB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
}

export default function BackupPage() {
    const { api } = useServer();
    const [backups, setBackups] = useState([]);
    const [domains, setDomains] = useState([]);
    const [domain, setDomain] = useState('');
    const [type, setType] = useState('full');
    const [loading, setLoading] = useState(false);

    const load = () => { api.get('/backup').then(r => setBackups(r.data.backups || [])).catch(() => {}); };
    useEffect(() => {
        if (!api) return;
        load();
        api.get('/domains').then(r => setDomains(r.data.domains || [])).catch(() => {});
    }, [api]);

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Backup</h1>
            <div className="card p-5 mb-6">
                <div className="flex gap-3 flex-wrap">
                    <select value={domain} onChange={e => setDomain(e.target.value)} className="input w-auto">
                        <option value="">Select domain...</option>
                        {domains.map(d => <option key={d.domain} value={d.domain}>{d.domain}</option>)}
                    </select>
                    <select value={type} onChange={e => setType(e.target.value)} className="input w-auto">
                        <option value="full">Full</option>
                        <option value="database">Database Only</option>
                    </select>
                    <button onClick={async () => { if (!domain) return; setLoading(true); await api.post('/backup/create', { domain, type }).catch(() => {}); load(); setLoading(false); }}
                        disabled={loading || !domain} className="btn-primary flex items-center">
                        <Archive className="w-4 h-4 mr-1" /> Create
                    </button>
                </div>
            </div>
            <div className="card overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">File</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Size</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {backups.length === 0 ? (
                            <tr><td colSpan="4" className="px-5 py-8 text-center text-gray-500">No backups</td></tr>
                        ) : backups.map(b => (
                            <tr key={b.name}>
                                <td className="px-5 py-4 font-mono text-sm">{b.name}</td>
                                <td className="px-5 py-4 text-sm">{b.type}</td>
                                <td className="px-5 py-4 text-sm">{formatSize(b.size)}</td>
                                <td className="px-5 py-4 text-right">
                                    <button onClick={async () => { if (!confirm(`Delete ${b.name}?`)) return; await api.delete(`/backup/${b.name}`); load(); }}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
