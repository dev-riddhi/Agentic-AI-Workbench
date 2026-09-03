"use client";

import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Users,
  Shield,
  Server,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { User } from '@/lib/api/types';
import { usersApi } from '@/lib/api/users';
import { useToast } from '@/context/toast-context';

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast, confirm } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New user form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Endpoint configuration - start empty, using placeholder hint
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [endpointSaved, setEndpointSaved] = useState(false);

  useEffect(() => {
    let active = true;
    usersApi.getUsers()
      .then((data) => {
        if (active) setUsers(data || []);
      })
      .catch((err: unknown) => {
        if (active) {
          const detail =
            (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
            'Failed to fetch user directory from backend API.';
          toast.error(detail, 'API Error');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [toast]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    setIsCreatingUser(true);
    setCreateError(null);
    try {
      const created = await usersApi.createUser(
        newUserName.trim(),
        newUserEmail.trim(),
        newUserPass.trim() || 'operatorpass123'
      );
      setUsers((prev) => [...prev, created]);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPass('');
      setCreateSuccess(true);
      toast.success(`Operator "${created.name}" registered in backend database.`, 'User Enrolled');
      setTimeout(() => setCreateSuccess(false), 3000);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to create user on backend API.';
      setCreateError(detail);
      toast.error(detail, 'Enrollment Failed');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Revoke User Access',
      message: `Revoke credentials and access for operator "${name}"? This permanently removes the account from the database.`,
      confirmText: 'Yes, Revoke Access',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!ok) return;

    try {
      await usersApi.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success(`Access revoked for "${name}".`, 'User Revoked');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to delete user on backend API.';
      toast.error(detail, 'Revoke Failed');
    }
  };

  const handleSaveEndpoint = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('custom_api_url', apiEndpoint);
    setEndpointSaved(true);
    toast.success('API Gateway Target URL updated.', 'Settings Saved');
    setTimeout(() => setEndpointSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* SECTION 1: USER PROFILE */}
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400">
            <UserIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Authenticated Operator Identity</h3>
            <p className="text-xs text-zinc-400">
              Session verified against FastAPI JWT validation endpoint (<code className="text-cyan-400">/users/me</code>)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs font-mono space-y-1">
            <span className="text-zinc-500 uppercase text-[10px]">Active Name</span>
            <div className="text-zinc-200 font-bold">{user?.name || 'Administrator'}</div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs font-mono space-y-1">
            <span className="text-zinc-500 uppercase text-[10px]">Email Address</span>
            <div className="text-zinc-200 font-bold">{user?.email || 'admin@example.com'}</div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs font-mono space-y-1">
            <span className="text-zinc-500 uppercase text-[10px]">Identity UUID</span>
            <div className="text-cyan-300 font-semibold truncate">{user?.id || '263a3d73-a189-4a72-92d2-408a5b4c33b1'}</div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs font-mono space-y-1">
            <span className="text-zinc-500 uppercase text-[10px]">Session Security</span>
            <div className="text-emerald-400 font-semibold flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              <span>JWT Bearer + Automated Refresh Rotation</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: ADMIN USER MANAGEMENT TABLE */}
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Authorized Personnel Directory</h3>
              <p className="text-xs text-zinc-400">
                Manage accounts stored directly in the PostgreSQL <code className="text-zinc-300 font-mono">users</code> table
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-zinc-500">
            {users.length} Users Enrolled
          </span>
        </div>

        {/* Users Table */}
        {isLoading ? (
          <div className="h-32 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-zinc-950/40 border border-dashed border-zinc-800 text-xs text-zinc-500 font-mono">
            No registered users returned from backend.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-mono uppercase text-[10px]">
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Enrolled At</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-950/40 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-zinc-200">{u.name}</td>
                    <td className="py-2.5 px-3 font-mono text-zinc-400">{u.email}</td>
                    <td className="py-2.5 px-3 font-mono text-zinc-500 text-[11px]">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {u.email !== 'admin@example.com' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Enroll New User Form */}
        <div className="pt-4 border-t border-zinc-800 space-y-3">
          <h4 className="text-xs font-bold font-mono text-zinc-300 uppercase">
            Enroll New Operator via API
          </h4>

          {createSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>New operator enrolled successfully in database!</span>
            </div>
          )}

          {createError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{createError}</span>
            </div>
          )}

          <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="Full Name"
              className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500"
            />
            <input
              type="email"
              required
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="Email Address"
              className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <input
              type="password"
              value={newUserPass}
              onChange={(e) => setNewUserPass(e.target.value)}
              placeholder="Passphrase"
              className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <button
              type="submit"
              disabled={isCreatingUser}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Enroll User</span>
            </button>
          </form>
        </div>
      </div>

      {/* SECTION 3: LOCAL ENDPOINT CONFIGURATION */}
      <form onSubmit={handleSaveEndpoint} className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Local API Gateway Target</h3>
            <p className="text-xs text-zinc-400">
              FastAPI backend endpoint URL configured for this workstation
            </p>
          </div>
        </div>

        {endpointSaved && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Endpoint configuration saved!</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5 font-mono">
            FASTAPI BASE URL
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="e.g. http://localhost:8000/api/v1"
              className="flex-1 px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 font-mono focus:outline-none focus:border-cyan-500 placeholder:text-zinc-600"
            />
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors cursor-pointer"
            >
              Update Target
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1.5 font-mono">
            Default: <code className="text-zinc-400">http://localhost:8000/api/v1</code>
          </p>
        </div>
      </form>
    </div>
  );
}
