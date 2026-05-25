import React, { useState, useEffect } from 'react';
import { getPhpInfo, changePhpVersion } from '../utils/api';
import { Code2, RefreshCw } from 'lucide-react';

export default function PHPPage() {
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [changing, setChanging] = useState(false);

    useEffect(() => {
        getPhpInfo()
            .then(r => setInfo(r.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const versions = ['7.4', '8.0', '8.1', '8.2', '8.3'];

    const handleChange = async (version) => {
        if (!confirm(`Switch to PHP ${version}?`)) return;
        setChanging(true);
        try {
            await changePhpVersion(version);
            alert(`PHP changed to ${version}`);
            getPhpInfo().then(r => setInfo(r.data));
        } catch (e) {
            alert('Failed to change PHP version.');
        }
        setChanging(false);
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">PHP Management</h1>

            <div className="card p-5 mb-6">
                <h3 className="font-semibold mb-3">Current Version</h3>
                <p className="text-lg font-mono">{info?.version || 'Loading...'}</p>
            </div>

            <div className="card p-5 mb-6">
                <h3 className="font-semibold mb-3">Change Version</h3>
                <div className="flex gap-2 flex-wrap">
                    {versions.map(v => (
                        <button key={v} onClick={() => handleChange(v)} disabled={changing}
                            className="btn-secondary">PHP {v}</button>
                    ))}
                </div>
            </div>

            <div className="card p-5">
                <h3 className="font-semibold mb-3">Loaded Modules ({info?.modules?.length || 0})</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-1">
                    {info?.modules?.map(m => (
                        <span key={m} className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded">
                            {m}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
