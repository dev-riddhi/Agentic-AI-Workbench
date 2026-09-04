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
  Building2,
  Sliders,
  Database,
  Save,
  Key,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { User } from '@/lib/api/types';
import { usersApi } from '@/lib/api/users';
import { settingsApi } from '@/lib/api/settings';
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

  // Settings Table State (BSON/JSON structure)
  const [companyName, setCompanyName] = useState('Agentic AI Workbench');
  const [maxConcurrentAgents, setMaxConcurrentAgents] = useState<number>(10);
  const [apiUrl, setApiUrl] = useState('http://localhost:8000/api/v1');
  const [environment, setEnvironment] = useState('development');
  const [defaultTimeout, setDefaultTimeout] = useState<number>(60);
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [extraKVs, setExtraKVs] = useState<Array<{ key: string; value: string }>>([]);
  const [newExtraKey, setNewExtraKey] = useState('');
  const [newExtraValue, setNewExtraValue] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    let active = true;

    // Load users
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

    // Load system settings from settings table
    settingsApi.getSettings()
      .then((res) => {
        if (!active || !res?.data) return;
        const d = res.data;
        if (d.company_name) setCompanyName(d.company_name);
        if (d.max_concurrent_agent_limit) setMaxConcurrentAgents(d.max_concurrent_agent_limit);
        if (d.api_url) setApiUrl(d.api_url);
        if (d.environment) setEnvironment(d.environment);
        if (d.default_timeout_seconds) setDefaultTimeout(d.default_timeout_seconds);
        if (typeof d.maintenance_mode === 'boolean') setMaintenanceMode(d.maintenance_mode);
        if (d.extra_values && typeof d.extra_values === 'object') {
          const kvs = Object.entries(d.extra_values).map(([k, v]) => ({
            key: k,
            value: typeof v === 'object' ? JSON.stringify(v) : String(v),
          }));
          setExtraKVs(kvs);
        }
      })
      .catch(() => {
        // Handled silently with defaults
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

  const handleAddExtraKV = () => {
    if (!newExtraKey.trim()) return;
    setExtraKVs((prev) => [...prev, { key: newExtraKey.trim(), value: newExtraValue.trim() }]);
    setNewExtraKey('');
    setNewExtraValue('');
  };

  const handleRemoveExtraKV = (idx: number) => {
    setExtraKVs((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const extra_values: Record<string, unknown> = {};
      for (const kv of extraKVs) {
        if (kv.key.trim()) {
          let parsedVal: unknown = kv.value;
          try {
            parsedVal = JSON.parse(kv.value);
          } catch {
            parsedVal = kv.value;
          }
          extra_values[kv.key.trim()] = parsedVal;
        }
      }

      await settingsApi.updateSettings({
        company_name: companyName.trim(),
        max_concurrent_agent_limit: maxConcurrentAgents,
        api_url: apiUrl.trim(),
        environment,
        default_timeout_seconds: defaultTimeout,
        maintenance_mode: maintenanceMode,
        extra_values,
      });

      // Keep local target synchronized
      localStorage.setItem('custom_api_url', apiUrl.trim());

      setSettingsSaved(true);
      toast.success('Settings table updated in database.', 'Settings Persisted');
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to persist settings to backend API.';
      toast.error(detail, 'Update Failed');
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* SECTION 1: SYSTEM & ORGANIZATION SETTINGS (BSON/JSON Structure) */}
      <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                System & Organization Settings
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  BSON / JSONB
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Configuration stored in PostgreSQL/SQLite <code className="text-zinc-300 font-mono">settings</code> table
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSavingSettings}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSavingSettings ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>

        {settingsSaved && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings successfully committed to the database!</span>
          </div>
        )}

        {/* Core Settings Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Company Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono text-zinc-300 uppercase">
              Company Name
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Corp / Agentic AI Workbench"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Max Concurrent Agent Limit */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono text-zinc-300 uppercase">
              Max Concurrent Agent Limit
            </label>
            <input
              type="number"
              min={1}
              required
              value={maxConcurrentAgents}
              onChange={(e) => setMaxConcurrentAgents(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Backend API URL */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono text-zinc-300 uppercase">
              FastAPI Gateway URL (api_url)
            </label>
            <input
              type="text"
              required
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8000/api/v1"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Environment */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono text-zinc-300 uppercase">
              Environment
            </label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </div>

          {/* Default Timeout */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono text-zinc-300 uppercase">
              Default Timeout (Seconds)
            </label>
            <input
              type="number"
              min={5}
              value={defaultTimeout}
              onChange={(e) => setDefaultTimeout(Math.max(5, parseInt(e.target.value) || 60))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Maintenance Mode Toggle */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono text-zinc-300 uppercase">
              System Maintenance Mode
            </label>
            <div
              onClick={() => setMaintenanceMode(!maintenanceMode)}
              className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                maintenanceMode
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="text-xs font-medium">
                {maintenanceMode ? 'Maintenance Mode Enabled' : 'Operational (Normal)'}
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  maintenanceMode ? 'border-rose-400 bg-rose-400' : 'border-zinc-700 bg-zinc-900'
                }`}
              >
                {maintenanceMode && <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
              </div>
            </div>
          </div>
        </div>

        {/* Custom BSON Key-Values Section */}
        <div className="pt-4 border-t border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-mono font-bold text-zinc-300 uppercase">
                Custom Key-Value Attributes (JSON Document)
              </span>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">
              {extraKVs.length} custom attributes defined
            </span>
          </div>

          {/* Existing Custom Key Values */}
          {extraKVs.length > 0 ? (
            <div className="space-y-2">
              {extraKVs.map((kv, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono"
                >
                  <span className="text-cyan-400 font-bold min-w-[120px]">{kv.key}:</span>
                  <span className="text-zinc-300 flex-1 truncate">{kv.value}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveExtraKV(idx)}
                    className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-zinc-950/40 border border-dashed border-zinc-800 text-[11px] font-mono text-zinc-500 text-center">
              No custom attributes yet. Add extensible key-value pairs below.
            </div>
          )}

          {/* Add New Key-Value Pair Form */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <input
              type="text"
              value={newExtraKey}
              onChange={(e) => setNewExtraKey(e.target.value)}
              placeholder="Key (e.g. cluster_region)"
              className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
            />
            <input
              type="text"
              value={newExtraValue}
              onChange={(e) => setNewExtraValue(e.target.value)}
              placeholder="Value (e.g. us-east-1 or true)"
              className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={handleAddExtraKV}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Attribute</span>
            </button>
          </div>
        </div>
      </form>

      {/* SECTION 2: USER PROFILE */}
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

      {/* SECTION 3: ADMIN USER MANAGEMENT TABLE */}
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
    </div>
  );
}
