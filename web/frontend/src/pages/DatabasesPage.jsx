import React, { useState, useEffect } from 'react';
import { useServer } from '../contexts/ServerContext';
import { Database, Plus, Trash2, Download } from 'lucide-react';

export default function DatabasesPage() {
    const { api } = useServer();
    const [databases, setDatabases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ name: '', user: '' });

    const load = () => {
        api.get('/databases').then(r => setDatabases(r.data.databases || [])).catch(() => {}).finally(() => setLoading(false));
    };
    useEffect(() => { if (api) load(); }, [api]);

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/databases', form);
            alert(`Created!\nDB: ${res.data.name}\nUser: ${res.data.user}\nPass: ${res.data.password}`);
            setShowAdd(false); setForm({ name: '', user: '' }); load();
        } catch (e) { alert(e.response?.data?.error || 'Failed'); }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Databases</h1>
                <button onClick={() => setShowAdd(!showAdd)} className="btn-primary flex items-center">
                    <Plus className="w-4 h-4 mr-1" /> Create
                </button>
            </div>

            {showAdd && (
                <div className="card p-5 mb-6">
                    <form onSubmit={handleAdd} className="flex gap-3">
                        <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                            className="input" placeholder="Database name" required />
                        <input type="text" value={form.user} onChange={e => setForm({...form, user: e.target.value})}
                            className="input" placeholder="Username" required />
                        <button type="submit" className="btn-primary">Create</button>
                        <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
                    </form>
                </div>
            )}

            <div className="card overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Database</th>
                            <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {loading ? (
                            <tr><td colSpan="2" className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
                        ) : databases.length === 0 ? (
                            <tr><td colSpan="2" className="px-5 py-8 text-center text-gray-500">No databases</td></tr>
                        ) : databases.map(db => (
                            <tr key={db}>
                                <td className="px-5 py-4 flex items-center">
                                    <Database className="w-4 h-4 text-primary-500 mr-2" /><span className="font-medium">{db}</span>
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <button onClick={async () => { const r = await api.post(`/databases/${db}/export`); alert(`Exported: ${r.data.file}`); }}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded mr-1"><Download className="w-4 h-4" /></button>
                                    <button onClick={async () => { if (!confirm(`Delete ${db}?`)) return; await api.delete(`/databases/${db}`); load(); }}
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
