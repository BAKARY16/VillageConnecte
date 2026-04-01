import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BornesPage from './pages/BornesPage';
import AgentsPage from './pages/AgentsPage';
import VouchersPage from './pages/VouchersPage';
import TransactionsPage from './pages/TransactionsPage';
import MonitoringPage from './pages/MonitoringPage';
import SessionsPage from './pages/SessionsPage';
import AlertsPage from './pages/AlertsPage';
import SettingsPage from './pages/SettingsPage';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import ToastContainer from './components/ui/Toast';
import './index.css';

function AppInner() {
  const { user, sidebarOpen, setSidebarOpen } = useApp();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (!user) return <LoginPage />;

  const pages = {
    dashboard: <DashboardPage />,
    bornes: <BornesPage />,
    agents: <AgentsPage />,
    vouchers: <VouchersPage />,
    transactions: <TransactionsPage />,
    monitoring: <MonitoringPage />,
    sessions: <SessionsPage />,
    alerts: <AlertsPage />,
    settings: <SettingsPage />,
  };

  return (
    <div className="app-layout">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        className={sidebarOpen ? '' : 'collapsed'}
      />
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <main className={`main-content ${sidebarOpen ? '' : 'expanded'}`}>
        <Header
          currentPage={currentPage}
          onToggleSidebar={() => setSidebarOpen(p => !p)}
        />
        <div className="page-content">
          {pages[currentPage] || <DashboardPage />}
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
