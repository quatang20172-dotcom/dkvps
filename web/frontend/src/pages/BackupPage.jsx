import React, { useState, useEffect } from 'react';
import { getBackups, createBackup, deleteBackup, getDomains } from '../utils/api';
import { Archive, Plus, Trash2, Download } from 'lucide-react';

function formatSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function BackupPage() {
    const [backups, setBackups] = useState([]);
    const [domains, setDomains] = useState([]);
    const [selectedDomain, setSelectedDomain] = useState('');
    const [backupType, setBackupType] = useState('full');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getBackups().then(r => setBackups(r.data.backups || [])).catch(() => {});
        getDomains().then(r => setDomains(r.data.domains || [])).catch(() => {});
    }, []);

    const handleCreate = async () => {
        if (!selectedDomain) return;
        setLoading(true);
        try {
            await createBackup(selectedDomain, backupType);
            alert('Backup created.');
            getBackups().then(r => setBackups(r.data.backups || []));
        } catch (e) {
            alert('Backup failed.');
        }
        setLoading(false);
    };

    const handleDelete = async (filename) => {
        if (!confirm(`Delete backup ${filename}?`)) return;
        await deleteBackup(filename);
        getBackups().then(r => setBackups(r.data.backups || []));
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Backup & Restore</h1>

            <div className="card p-5 mb-6">
                <h3 className="font-semibold mb-3">Create Backup</h3>
                <div className="flex gap-3 flex-wrap">
                    <select value={selectedDomain} onChange={e => setSelectedDomain(e.target.value)} className="input w-auto">
                        <option value="">Select domain...</option>
                        {domains.map(d => <option key={d.domain} value={d.domain}>{d.domain}</option>)}
                    </select>
                    <select value={backupType} onChange={e => setBackupType(e.target.value)} className="input w-auto">
                        <option value="full">Full (Source + DB)</option>
                        <option value="database">Database Only</option>
                    </select>
                    <button onClick={handleCreate} disabled={loading || !selectedDomain} className="btn-primary flex items-center">
                        <Archive className="w-4 h-4 mr-1" /> Create Backup
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
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {backups.length === 0 ? (
                            <tr><td colSpan="5" className="px-5 py-8 text-center text-gray-500">No backups.</td></tr>
                        ) : backups.map(b => (
                            <tr key={b.name}>
                                <td className="px-5 py-4 font-mono text-sm">{b.name}</td>
                                <td className="px-5 py-4 text-sm">{b.type}</td>
                                <td className="px-5 py-4 text-sm">{formatSize(b.size)}</td>
                                <td className="px-5 py-4 text-sm text-gray-500">{new Date(b.created).toLocaleString()}</td>
                                <td className="px-5 py-4 text-right">
                                    <button onClick={() => handleDelete(b.name)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
