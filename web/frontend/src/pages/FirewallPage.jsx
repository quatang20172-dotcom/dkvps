import React, { useState, useEffect } from 'react';
import { getFirewallStatus, openPort, closePort } from '../utils/api';
import { Shield, Plus, X } from 'lucide-react';

export default function FirewallPage() {
    const [status, setStatus] = useState(null);
    const [newPort, setNewPort] = useState('');
    const [loading, setLoading] = useState(true);

    const load = () => {
        getFirewallStatus()
            .then(r => setStatus(r.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleOpen = async () => {
        if (!newPort) return;
        await openPort(newPort, 'tcp');
        setNewPort('');
        load();
    };

    const handleClose = async (port) => {
        if (!confirm(`Close port ${port}?`)) return;
        await closePort(port.replace('/tcp', '').replace('/udp', ''), 'tcp');
        load();
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Firewall</h1>

            <div className="card p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Status: {status?.state || 'N/A'}</h3>
                </div>

                <div className="flex gap-3 mb-4">
                    <input type="text" value={newPort} onChange={e => setNewPort(e.target.value)}
                        className="input w-40" placeholder="Port number" />
                    <button onClick={handleOpen} className="btn-primary flex items-center">
                        <Plus className="w-4 h-4 mr-1" /> Open Port
                    </button>
                </div>

                <h4 className="text-sm font-semibold text-gray-500 mb-2">Open Ports</h4>
                <div className="flex flex-wrap gap-2">
                    {status?.ports?.map(port => (
                        <span key={port} className="inline-flex items-center px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-sm">
                            {port}
                            <button onClick={() => handleClose(port)} className="ml-1 hover:text-red-500">
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                    {(!status?.ports || status.ports.length === 0) && (
                        <span className="text-sm text-gray-500">No custom ports open.</span>
                    )}
                </div>
            </div>
        </div>
    );
}
