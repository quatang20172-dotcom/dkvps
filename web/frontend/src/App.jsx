import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getMe } from './utils/api';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DomainsPage from './pages/DomainsPage';
import DatabasesPage from './pages/DatabasesPage';
import ServicesPage from './pages/ServicesPage';
import SSLPage from './pages/SSLPage';
import PHPPage from './pages/PHPPage';
import FirewallPage from './pages/FirewallPage';
import CachePage from './pages/CachePage';
import BackupPage from './pages/BackupPage';
import MonitorPage from './pages/MonitorPage';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getMe()
            .then(res => setUser(res.data.user))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={
                    user ? <Navigate to="/" /> : <LoginPage onLogin={setUser} />
                } />
                <Route path="/*" element={
                    user ? (
                        <Layout user={user} onLogout={() => setUser(null)}>
                            <Routes>
                                <Route path="/" element={<DashboardPage />} />
                                <Route path="/domains" element={<DomainsPage />} />
                                <Route path="/databases" element={<DatabasesPage />} />
                                <Route path="/services" element={<ServicesPage />} />
                                <Route path="/ssl" element={<SSLPage />} />
                                <Route path="/php" element={<PHPPage />} />
                                <Route path="/firewall" element={<FirewallPage />} />
                                <Route path="/cache" element={<CachePage />} />
                                <Route path="/backup" element={<BackupPage />} />
                                <Route path="/monitor" element={<MonitorPage />} />
                            </Routes>
                        </Layout>
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
