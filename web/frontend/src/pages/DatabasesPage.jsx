import React, { useState, useEffect } from 'react';
import { getDatabases, createDatabase, deleteDatabase, exportDatabase } from '../utils/api';
import { Database, Plus, Trash2, Download } from 'lucide-react';

export default function DatabasesPage() {
    const [databases, setDatabases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ name: '', user: '', password: '' });

    const load = () => {
        getDatabases()
            .then(r => setDatabases(r.data.databases || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            const res = await createDatabase(form);
            alert(`Database created!\nName: ${res.data.name}\nUser: ${res.data.user}\nPassword: ${res.data.password}`);
            setShowAdd(false);
            setForm({ name: '', user: '', password: '' });
            load();
        } catch (e) {
            alert(e.response?.data?.error || 'Failed.');
        }
    };

    const handleDelete = async (name) => {
        if (!confirm(`Delete database ${name}?`)) return;
        await deleteDatabase(name);
        load();
    };

    const handleExport = async (name) => {
        try {
            const res = await exportDatabase(name);
            alert(`Exported to: ${res.data.file}`);
        } catch (e) {
            alert('Export failed.');
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Databases</h1>
                <button onClick={() => setShowAdd(!showAdd)} className="btn-primary flex items-center">
                    <Plus className="w-4 h-4 mr-1" /> Create Database
                </button>
            </div>

            {showAdd && (
                <div className="card p-5 mb-6">
                    <h3 className="font-semibold mb-3">Create Database</h3>
                    <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                            className="input" placeholder="Database name" required />
                        <input type="text" value={form.user} onChange={e => setForm({...form, user: e.target.value})}
                            className="input" placeholder="Username" required />
                        <input type="text" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                            className="input" placeholder="Password (auto-generate if empty)" />
                        <div className="md:col-span-3 flex gap-2">
                            <button type="submit" className="btn-primary">Create</button>
                            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
                        </div>
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
                            <tr><td colSpan="2" className="px-5 py-8 text-center text-gray-500">No databases.</td></tr>
                        ) : databases.map(db => (
                            <tr key={db} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                <td className="px-5 py-4">
                                    <div className="flex items-center">
                                        <Database className="w-4 h-4 text-primary-500 mr-2" />
                                        <span className="font-medium">{db}</span>
                                    </div>
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <button onClick={() => handleExport(db)}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded mr-1" title="Export">
                                        <Download className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(db)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
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
