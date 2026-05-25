import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ServerProvider, useServer } from './contexts/ServerContext';
import Layout from './components/layout/Layout';
import SetupPage from './pages/SetupPage';
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
import ServersPage from './pages/ServersPage';

function AppRoutes() {
    const { activeServer } = useServer();

    if (!activeServer) {
        return (
            <Routes>
                <Route path="*" element={<SetupPage />} />
            </Routes>
        );
    }

    return (
        <Layout>
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
                <Route path="/servers" element={<ServersPage />} />
            </Routes>
        </Layout>
    );
}

function App() {
    return (
        <ServerProvider>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </ServerProvider>
    );
}

export default App;
