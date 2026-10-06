import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  ShieldCheck, 
  UserCheck, 
  Eye, 
  Crown,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { 
  fetchWorkspaces, 
  createWorkspace, 
  deleteWorkspace, 
  fetchWorkspaceMembers, 
  addWorkspaceMember, 
  removeWorkspaceMember,
  fetchUsers
} from '../api/client';

export default function WorkspaceModal({ isOpen, onClose, activeWorkspace, onWorkspaceChanged }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWs, setSelectedWs] = useState(activeWorkspace);
  const [members, setMembers] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState('analyst');
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedWs) {
      loadMembers(selectedWs.id);
    }
  }, [selectedWs]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [wsList, uList] = await Promise.all([
        fetchWorkspaces().catch(() => []),
        fetchUsers().catch(() => [])
      ]);
      setWorkspaces(wsList || []);
      setSystemUsers(uList || []);
      if (!selectedWs && wsList.length > 0) {
        setSelectedWs(wsList[0]);
      }
    } catch (err) {
      console.error('Failed to load workspace data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMembers = async (wsId) => {
    try {
      const mList = await fetchWorkspaceMembers(wsId);
      setMembers(mList || []);
    } catch (err) {
      console.warn('Failed to load workspace members:', err);
      setMembers([]);
    }
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    try {
      const created = await createWorkspace({
        name: newWsName.trim(),
        description: newWsDesc.trim() || 'Organization analytics workspace'
      });
      setWorkspaces(prev => [...prev, created]);
      setSelectedWs(created);
      onWorkspaceChanged(created);
      setNewWsName('');
      setNewWsDesc('');
      setIsCreating(false);
      setStatusMsg({ type: 'success', text: `Workspace '${created.name}' created!` });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleDeleteWorkspace = async (wsId) => {
    if (wsId === 1) {
      alert('The primary default workspace cannot be deleted.');
      return;
    }
    if (!confirm('Are you sure you want to delete this workspace and its member associations?')) return;
    try {
      await deleteWorkspace(wsId);
      const remaining = workspaces.filter(w => w.id !== wsId);
      setWorkspaces(remaining);
      const fallback = remaining[0] || null;
      setSelectedWs(fallback);
      if (fallback) onWorkspaceChanged(fallback);
      setStatusMsg({ type: 'success', text: 'Workspace deleted.' });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedUserToAdd || !selectedWs) return;
    try {
      await addWorkspaceMember(selectedWs.id, {
        username: selectedUserToAdd,
        role: selectedRoleToAdd
      });
      await loadMembers(selectedWs.id);
      setSelectedUserToAdd('');
      setStatusMsg({ type: 'success', text: `Added ${selectedUserToAdd} to ${selectedWs.name}` });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm('Remove user from this workspace?')) return;
    try {
      await removeWorkspaceMember(selectedWs.id, memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
      setStatusMsg({ type: 'success', text: 'User removed from workspace.' });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        width: '840px',
        maxWidth: '100%',
        maxHeight: '90vh',
        background: '#ffffff',
        borderRadius: '20px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: '#e0e7ff',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Building2 size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#0f172a' }}>
                Multi-Tenant Workspaces & Teams
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                Isolated client portals, organizational boundaries, and role-based membership
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body: Split Columns */}
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          minHeight: '440px',
          overflow: 'hidden'
        }}>
          {/* Left Column: Workspaces List */}
          <div style={{
            borderRight: '1px solid #e2e8f0',
            background: '#fafafa',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                Workspaces ({workspaces.length})
              </span>
              <button
                onClick={() => setIsCreating(true)}
                style={{
                  background: '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <Plus size={12} />
                <span>New</span>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
              {workspaces.map((ws) => {
                const isSelected = selectedWs?.id === ws.id;
                return (
                  <div
                    key={ws.id}
                    onClick={() => {
                      setSelectedWs(ws);
                      onWorkspaceChanged(ws);
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: isSelected ? '#ffffff' : 'transparent',
                      border: isSelected ? '1.5px solid #818cf8' : '1px solid transparent',
                      boxShadow: isSelected ? '0 4px 12px rgba(79, 70, 229, 0.08)' : 'none',
                      cursor: 'pointer',
                      marginBottom: '6px',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '800', color: isSelected ? '#4338ca' : '#1e293b' }}>
                        {ws.name}
                      </span>
                      {ws.id === 1 && (
                        <span style={{ fontSize: '0.62rem', background: '#e2e8f0', color: '#475569', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                          PRIMARY
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ws.description || 'No description'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Workspace Management */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '24px',
            background: '#ffffff'
          }}>
            {/* Create Workspace Form Overlay */}
            {isCreating ? (
              <form onSubmit={handleCreateWorkspace} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#0f172a' }}>
                  Create New Client / Organization Workspace
                </h3>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Workspace Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                    placeholder="e.g. Acme Corp Portal or Q4 Marketing"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Description
                  </label>
                  <input
                    type="text"
                    value={newWsDesc}
                    onChange={(e) => setNewWsDesc(e.target.value)}
                    placeholder="Short description of client or tenant domain"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                    Create Workspace
                  </button>
                  <button type="button" onClick={() => setIsCreating(false)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : selectedWs ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Workspace Details Banner */}
                <div style={{
                  padding: '16px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0f172a' }}>
                        {selectedWs.name}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        slug: <code>{selectedWs.slug}</code>
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                      {selectedWs.description || 'Enterprise analytics tenant'}
                    </div>
                  </div>

                  {selectedWs.id !== 1 && (
                    <button
                      onClick={() => handleDeleteWorkspace(selectedWs.id)}
                      style={{
                        background: '#fee2e2',
                        color: '#b91c1c',
                        border: '1px solid #fca5a5',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  )}
                </div>

                {/* Team Members Section */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={16} color="#4f46e5" />
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800', color: '#0f172a' }}>
                        Workspace Team Members
                      </h4>
                    </div>
                  </div>

                  {/* Add Member Bar */}
                  <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <select
                      value={selectedUserToAdd}
                      onChange={(e) => setSelectedUserToAdd(e.target.value)}
                      required
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.8rem'
                      }}
                    >
                      <option value="">Select registered user to add...</option>
                      {systemUsers.map(u => (
                        <option key={u.id} value={u.username}>
                          {u.username} ({u.role}) - {u.email}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedRoleToAdd}
                      onChange={(e) => setSelectedRoleToAdd(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.8rem'
                      }}
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="analyst">Analyst</option>
                      <option value="viewer">Viewer</option>
                    </select>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ padding: '8px 14px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                    >
                      Add Member
                    </button>
                  </form>

                  {/* Members Table */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '8px 12px', color: '#475569', fontWeight: '700' }}>User</th>
                          <th style={{ padding: '8px 12px', color: '#475569', fontWeight: '700' }}>Role</th>
                          <th style={{ padding: '8px 12px', color: '#475569', fontWeight: '700' }}>Joined</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', color: '#475569', fontWeight: '700' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>
                              All system users currently inherit access to default workspace.
                            </td>
                          </tr>
                        ) : (
                          members.map(m => (
                            <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>
                                {m.username}
                                <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 'normal' }}>{m.email}</div>
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{
                                  fontSize: '0.7rem',
                                  fontWeight: '700',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: m.role === 'owner' ? '#fef3c7' : m.role === 'admin' ? '#e0e7ff' : '#f1f5f9',
                                  color: m.role === 'owner' ? '#92400e' : m.role === 'admin' ? '#4338ca' : '#475569'
                                }}>
                                  {m.role.toUpperCase()}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', color: '#64748b' }}>
                                {new Date(m.joined_at).toLocaleDateString()}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                <button
                                  onClick={() => handleRemoveMember(m.id)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    padding: '4px'
                                  }}
                                  title="Remove member"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            {statusMsg && (
              <div style={{
                marginTop: '16px',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: '600',
                background: statusMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
                color: statusMsg.type === 'success' ? '#166534' : '#991b1b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>{statusMsg.text}</span>
                <X size={14} style={{ cursor: 'pointer' }} onClick={() => setStatusMsg(null)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
