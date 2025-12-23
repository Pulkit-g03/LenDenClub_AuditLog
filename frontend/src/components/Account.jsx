// src/components/Account.jsx
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import jsPDF from 'jspdf';

const Account = () => {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [logs, setLogs] = useState([]);
  const [receiverIdentifier, setReceiverIdentifier] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });

  const fetchData = async () => {
    try {
      const [userRes, historyRes] = await Promise.all([
        api.get('/me'),
        api.get('/history')
      ]);
      setUser(userRes.data);
      setBalance(userRes.data.balance || 0);
      setLogs(historyRes.data || []);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!user || !receiverIdentifier || !amount) return;
    setLoading(true);
    try {
      await api.post('/transfer', {
        sender_id: user.id,
        receiver_identifier: receiverIdentifier,
        amount: parseFloat(amount),
      });
      setBalance(prev => prev - parseFloat(amount));
      setReceiverIdentifier('');
      setAmount('');
      const historyRes = await api.get('/history');
      setLogs(historyRes.data || []);
      alert('Transfer successful!');
    } catch (err) {
      alert('Transfer failed: ' + (err.response?.data?.detail || 'Server error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    const sorted = [...logs].sort((a, b) => {
      if (key === 'timestamp') {
        return direction === 'asc' 
          ? new Date(a.timestamp) - new Date(b.timestamp) 
          : new Date(b.timestamp) - new Date(a.timestamp);
      }
      if (key === 'amount') {
        return direction === 'asc' ? a.amount - b.amount : b.amount - a.amount;
      }
      return 0;
    });
    setLogs(sorted);
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    return formatter.format(date);
  };

  const getInitials = (id) => {
    return typeof id === 'number' ? id.toString()[0] : (id?.[0]?.toUpperCase() || 'U');
  };

  const getColorClass = (index) => {
    const colors = ['blue', 'orange', 'purple'];
    return colors[index % colors.length];
  };

  const getStatusClass = (status, senderId) => {
    if (status !== 'SUCCESS') return 'pending';
    return user?.id === senderId ? 'success' : 'success-alt';
  };

  const getCounterpartyDisplay = (log) => {
    const isOutgoing = log.sender_id === user.id;
    const counterpartyId = isOutgoing ? log.receiver_id : log.sender_id;

    if (typeof counterpartyId === 'string' && counterpartyId.includes('@')) {
      return counterpartyId;
    }
    return counterpartyId?.toString() || 'Unknown';
  };

  // === LOGOUT ===
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  // === EXPORT TO CSV ===
  const exportToCSV = () => {
    if (logs.length === 0) {
      alert('No transactions to export.');
      return;
    }

    const headers = 'Transaction ID,Counterparty,Date,Status,Amount\n';
    const rows = logs.map(log => {
      const isOutgoing = log.sender_id === user.id;
      const counterparty = getCounterpartyDisplay(log);
      const date = formatDate(log.timestamp);
      const status = log.status === 'SUCCESS' ? (isOutgoing ? 'Sent' : 'Received') : log.status;
      const amount = (isOutgoing ? '-' : '+') + log.amount.toFixed(2);
      return `"${log.id}","${counterparty.replace(/"/g, '""')}","${date}","${status}","${amount}"`;
    }).join('\n');

    const csvContent = headers + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Peer2Paisa_Transactions_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // === EXPORT TO PDF ===
  const exportToPDF = () => {
    if (logs.length === 0) {
      alert('No transactions to export.');
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Peer2Paisa - Transaction History', 14, 22);
    doc.setFontSize(12);
    doc.text(`Account: ${user.email}`, 14, 32);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);

    let y = 55;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ID    Counterparty         Date             Status         Amount', 14, y);
    y += 8;
    doc.setFont('helvetica', 'normal');

    logs.forEach(log => {
      const isOutgoing = log.sender_id === user.id;
      const counterparty = getCounterpartyDisplay(log);
      const date = formatDate(log.timestamp);
      const status = log.status === 'SUCCESS' ? (isOutgoing ? 'Sent' : 'Received') : log.status;
      const amount = (isOutgoing ? '-' : '+') + '₹' + log.amount.toFixed(2);

      const line = `${log.id.toString().padEnd(6)}${counterparty.padEnd(20)}${date.padEnd(17)}${status.padEnd(14)}${amount}`;
      doc.text(line, 14, y);
      y += 8;

      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save(`Peer2Paisa_Transactions_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  if (!user) {
    return <div style={{ textAlign: 'center', padding: '100px' }}>Loading dashboard...</div>;
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="top-nav">
        <div className="logo">
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
              <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
              <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
            </svg>
          </div>
          <span className="logo-text">Peer2Paisa</span>
        </div>
        <div className="user-profile">
          <div className="user-info">
            <span className="welcome-text">Welcome back,</span>
            <span className="user-name">{user.email.split('@')[0]}</span>
          </div>
          <img src={`https://i.pravatar.cc/150?u=${user.email}`} alt="Avatar" className="avatar" />
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <aside className="sidebar">
          {/* Balance Card */}
          <div className="card balance-card">
            <p className="label">Current Balance</p>
            <h1 className="balance-amount">₹{balance.toFixed(2)}</h1>
            <div className="card-pattern" />
          </div>

          {/* Quick Transfer */}
          <div className="card transfer-card">
            <div className="card-header">
              <div className="icon-box purple">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </div>
              <h2>Quick Transfer</h2>
            </div>
            <form className="transfer-form" onSubmit={handleTransfer}>
              <div className="input-group">
                <label>Receiver ID / Email</label>
                <div className="input-wrapper">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    type="text"
                    placeholder="e.g. user@example.com or 123"
                    value={receiverIdentifier}
                    onChange={(e) => setReceiverIdentifier(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="input-group">
                <label>Amount (₹)</label>
                <div className="input-wrapper">
                  <span className="currency-symbol">₹</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Transferring...' : `Send ₹${amount || '0.00'}`}
              </button>
            </form>
          </div>
        </aside>

        <section className="table-card">
          <div className="table-header">
            <div className="title-with-icon">
              <div className="icon-circle">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <h2>Transaction History</h2>
            </div>
            <div className="table-actions">
              <button className="btn-outline" onClick={exportToCSV}>Export CSV</button>
              <button className="btn-outline" onClick={exportToPDF}>Export PDF</button>
              <button className="btn-logout" onClick={handleLogout}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
              </button>
            </div>
          </div>

          <table className="transaction-table">
            <thead>
              <tr>
                <th>ID</th>
                <th onClick={() => handleSort('counterparty')} style={{ cursor: 'pointer' }}>
                  COUNTERPARTY {sortConfig.key === 'counterparty' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('timestamp')} style={{ cursor: 'pointer' }}>
                  DATE {sortConfig.key === 'timestamp' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th>STATUS</th>
                <th className="text-right" onClick={() => handleSort('amount')} style={{ cursor: 'pointer' }}>
                  AMOUNT {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No transactions yet
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => {
                  const isOutgoing = log.sender_id === user.id;
                  const counterpartyId = isOutgoing ? log.receiver_id : log.sender_id;

                  return (
                    <tr key={log.id}>
                      <td className="text-muted">#{log.id}</td>
                      <td>
                        <div className="user-cell">
                          <span className={`initials ${getColorClass(index)}`}>
                            {getInitials(counterpartyId)}
                          </span>
                          <span>{getCounterpartyDisplay(log)}</span>
                        </div>
                      </td>
                      <td className="text-muted">{formatDate(log.timestamp)}</td>
                      <td>
                        <span className={`status-pill ${getStatusClass(log.status, log.sender_id)}`}>
                          {log.status === 'SUCCESS' ? (isOutgoing ? 'Sent' : 'Received') : log.status}
                        </span>
                      </td>
                      <td className={`text-right font-bold ${!isOutgoing ? 'text-green' : ''}`}>
                        {isOutgoing ? '-' : '+'}₹{log.amount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="table-footer">
            <span>Showing 1 to {logs.length} of {logs.length} entries</span>
            <div className="pagination">
              <button className="btn-icon" disabled><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg></button>
              <button className="btn-icon" disabled><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg></button>
            </div>
          </div>
        </section>
      </main>

      <style jsx>{`
        :root {
          --primary: #534ced;
          --bg-light: #f8fafc;
          --text-main: #1e293b;
          --text-muted: #64748b;
          --border-color: #e2e8f0;
          --white: #ffffff;
          --success-text: #10b981;
        }
        body { background-color: var(--bg-light); color: var(--text-main); font-family: 'Inter', sans-serif; }
        .dashboard-container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        .top-nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; border-bottom: 1px solid var(--border-color); margin-bottom: 30px; }
        .logo { display: flex; align-items: center; gap: 10px; }
        .logo-icon { background: var(--primary); color: white; padding: 6px; border-radius: 8px; display: flex; }
        .logo-text { font-weight: 700; font-size: 20px; color: #0f172a; }
        .user-profile { display: flex; align-items: center; gap: 12px; }
        .user-info { text-align: right; }
        .welcome-text { display: block; font-size: 12px; color: var(--text-muted); }
        .user-name { font-weight: 600; font-size: 14px; }
        .avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
        .main-content { display: grid; grid-template-columns: 320px 1fr; gap: 24px; padding-bottom: 40px; }
        .card { background: var(--white); border-radius: 16px; border: 1px solid var(--border-color); overflow: hidden; }
        .sidebar { display: flex; flex-direction: column; gap: 24px; }
        .balance-card { background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); color: white; padding: 24px; position: relative; border: none; }
        .balance-card .label { font-size: 13px; opacity: 0.9; margin-bottom: 8px; }
        .balance-amount { font-size: 32px; font-weight: 700; margin-bottom: 20px; }
        .trend-badge { background: rgba(255, 255, 255, 0.2); display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; font-size: 12px; }
        .card-pattern { position: absolute; right: -10px; top: 10px; width: 100px; height: 100px; background: url('data:image/svg+xml,<svg width="100" height="100" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 10V5C2 3.89543 2.89543 3 4 3H20C21.1046 3 22 3.89543 22 5V10M2 10V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V10M2 10H22" stroke="white" stroke-opacity="0.2" stroke-width="2"/></svg>') no-repeat; opacity: 0.4; }
        .transfer-card { padding: 24px; }
        .card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
        .icon-box.purple { background: #eef2ff; color: var(--primary); padding: 10px; border-radius: 10px; }
        .card-header h2 { font-size: 18px; font-weight: 600; }
        .input-group { margin-bottom: 16px; }
        .input-group label { display: block; font-size: 13px; color: var(--text-muted); margin-bottom: 8px; }
        .input-wrapper { position: relative; display: flex; align-items: center; }
        .input-wrapper svg, .currency-symbol { position: absolute; left: 12px; color: var(--text-muted); }
        .input-wrapper input { width: 100%; padding: 12px 12px 12px 38px; border: 1px solid var(--border-color); border-radius: 8px; outline: none; font-size: 14px; }
        .btn-primary { width: 100%; background: var(--primary); color: white; border: none; padding: 14px; border-radius: 10px; font-weight: 600; cursor: pointer; margin-top: 8px; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .table-card { display: flex; flex-direction: column; }
        .table-header { padding: 24px; display: flex; justify-content: space-between; align-items: center; }
        .title-with-icon { display: flex; align-items: center; gap: 12px; }
        .icon-circle { width: 36px; height: 36px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .table-actions { display: flex; gap: 10px; }
        .btn-outline { background: white; border: 1px solid var(--border-color); padding: 8px 16px; border-radius: 8px; font-size: 13px; color: var(--text-muted); cursor: pointer; }
        .btn-logout { 
          background: #fee2e2; 
          border: 1px solid #fecaca; 
          padding: 8px 16px; 
          border-radius: 8px; 
          font-size: 13px; 
          color: #dc2626; 
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
          transition: all 0.2s;
        }
        .btn-logout:hover {
          background: #fecaca;
          border-color: #fca5a5;
        }
        .transaction-table { width: 100%; border-collapse: collapse; }
        .transaction-table th { text-align: left; padding: 12px 24px; font-size: 11px; color: var(--text-muted); letter-spacing: 0.05em; border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); }
        .transaction-table td { padding: 16px 24px; font-size: 14px; border-bottom: 1px solid var(--border-color); }
        .text-muted { color: var(--text-muted); }
        .text-right { text-align: right; }
        .font-bold { font-weight: 600; }
        .text-green { color: var(--success-text); }
        .user-cell { display: flex; align-items: center; gap: 12px; font-weight: 500; }
        .initials { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: white; }
        .blue { background: #dbeafe; color: #1d4ed8; }
        .orange { background: #ffedd5; color: #c2410c; }
        .purple { background: #ede9fe; color: #6d28d9; }
        .status-pill { padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; }
        .status-pill.success { background: #dcfce7; color: #15803d; }
        .status-pill.success-alt { background: #ecfdf5; color: #10b981; }
        .status-pill.pending { background: #fef3c7; color: #92400e; }
        .table-footer { padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text-muted); }
        .pagination { display: flex; gap: 8px; }
        .btn-icon { background: none; border: none; color: var(--text-muted); cursor: not-allowed; }
        @media (max-width: 900px) { .main-content { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
};

export default Account;