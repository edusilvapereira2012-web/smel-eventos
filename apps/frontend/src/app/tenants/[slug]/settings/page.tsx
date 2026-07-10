'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useTenant } from '@/components/tenant-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { ArrowLeft, UserPlus, ShieldAlert, Trash2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function TenantSettings() {
  const { activeTenant, refetchTenants } = useTenant();
  const { hasPermission, role: userRole, loading: loadingPerms } = usePermissions();
  const router = useRouter();

  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Update Tenant Form
  const [tenantName, setTenantName] = useState(activeTenant?.name || '');
  const [updatingTenant, setUpdatingTenant] = useState(false);

  // Invite Member Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);

  // Alert State
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchMembers = async () => {
    if (!activeTenant) return;
    try {
      setLoadingMembers(true);
      const response = await api.get(`/tenants/${activeTenant.id}/members`);
      setMembers(response.data);
    } catch (err) {
      console.error('Falha ao buscar membros:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (activeTenant) {
      setTenantName(activeTenant.name);
      fetchMembers();
    }
  }, [activeTenant]);

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !hasPermission('tenants.update')) return;

    setUpdatingTenant(true);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/tenants/${activeTenant.id}`, { name: tenantName });
      setSuccess('Organização atualizada com sucesso.');
      await refetchTenants();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao atualizar a organização.');
    } finally {
      setUpdatingTenant(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !hasPermission('members.create')) return;

    setInviting(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post(`/tenants/${activeTenant.id}/members`, {
        email: inviteEmail,
        role: inviteRole,
      });
      setSuccess('Membro adicionado e convite enfileirado com sucesso.');
      setInviteEmail('');
      await fetchMembers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao adicionar membro.');
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!activeTenant || !hasPermission('members.update')) return;
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/tenants/${activeTenant.id}/members/${userId}`, {
        role: newRole,
      });
      setSuccess('Função do membro atualizada com sucesso.');
      await fetchMembers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao alterar função.');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeTenant || !hasPermission('members.delete')) return;
    if (!confirm('Deseja realmente remover este membro da organização?')) return;
    setError(null);
    setSuccess(null);

    try {
      await api.delete(`/tenants/${activeTenant.id}/members/${userId}`);
      setSuccess('Membro removido com sucesso.');
      await fetchMembers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao remover membro.');
    }
  };

  if (!activeTenant) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <p>Selecione ou crie um tenant para visualizar as configurações.</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 px-6 py-12 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-violet-900/10 blur-[120px]" />
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-blue-900/10 blur-[120px]" />
      </div>

      <div className="max-w-5xl mx-auto space-y-8 relative">
        <div className="flex items-center space-x-2">
          <Link href="/" className="inline-flex p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-semibold text-slate-400">Voltar ao Painel</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-violet-500">
            Configurações da Organização
          </h1>
          <p className="text-slate-400">
            Gerencie as informações da organização e membros de <span className="text-violet-400 font-semibold">{activeTenant.name}</span>.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-950/40 border border-red-800/50 p-4 text-sm text-red-400 flex items-center space-x-2">
            <ShieldAlert className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/50 p-4 text-sm text-emerald-400 flex items-center space-x-2">
            <CheckCircle2 className="h-5 w-5" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left panel: Info & Invite */}
          <div className="space-y-8 lg:col-span-1">
            {/* Update Info Form */}
            <div className="p-6 bg-slate-900/40 rounded-xl border border-slate-800/80 backdrop-blur-xl space-y-4">
              <h3 className="text-lg font-bold text-slate-250">Geral</h3>
              <form onSubmit={handleUpdateTenant} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-450 uppercase">Nome da Organização</label>
                  <input
                    type="text"
                    required
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    disabled={!hasPermission('tenants.update')}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-450 uppercase">Slug (Identificador único)</label>
                  <input
                    type="text"
                    disabled
                    value={activeTenant.slug}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
                  />
                </div>

                {hasPermission('tenants.update') && (
                  <Button
                    type="submit"
                    disabled={updatingTenant}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs py-2 rounded-lg transition-colors"
                  >
                    {updatingTenant ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                )}
              </form>
            </div>

            {/* Invite Form */}
            {hasPermission('members.create') && (
              <div className="p-6 bg-slate-900/40 rounded-xl border border-slate-800/80 backdrop-blur-xl space-y-4">
                <h3 className="text-lg font-bold text-slate-250 flex items-center space-x-2">
                  <UserPlus className="h-5 w-5 text-violet-400" />
                  <span>Adicionar Membro</span>
                </h3>
                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-450 uppercase">E-mail do Usuário</label>
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-450 uppercase">Permissão (Cargo)</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    >
                      <option value="MEMBER">Membro</option>
                      <option value="CHECKER">Checker (Validador)</option>
                      <option value="ORGANIZER">Organizador</option>
                      <option value="ADMIN">Administrador</option>
                      <option value="OWNER">Proprietário (Owner)</option>
                    </select>
                  </div>

                  <Button
                    type="submit"
                    disabled={inviting}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs py-2 rounded-lg transition-colors"
                  >
                    {inviting ? 'Adicionando...' : 'Adicionar Membro'}
                  </Button>
                </form>
              </div>
            )}
          </div>

          {/* Right panel: Member list */}
          <div className="space-y-4 lg:col-span-2 p-6 bg-slate-900/40 rounded-xl border border-slate-800/80 backdrop-blur-xl">
            <h3 className="text-lg font-bold text-slate-250">Membros da Organização</h3>

            {loadingMembers ? (
              <div className="space-y-3">
                <div className="h-10 w-full animate-pulse rounded bg-slate-800/40" />
                <div className="h-10 w-full animate-pulse rounded bg-slate-800/40" />
                <div className="h-10 w-full animate-pulse rounded bg-slate-800/40" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                  <thead className="text-xs text-slate-400 uppercase border-b border-slate-850">
                    <tr>
                      <th className="py-3 px-4">Nome</th>
                      <th className="py-3 px-4">E-mail</th>
                      <th className="py-3 px-4">Função</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} className="border-b border-slate-900 hover:bg-slate-900/20 transition-colors">
                        <td className="py-3 px-4 text-slate-200 font-medium">{m.user.name}</td>
                        <td className="py-3 px-4">{m.user.email}</td>
                        <td className="py-3 px-4">
                          {hasPermission('members.update') ? (
                            <select
                              value={m.role}
                              onChange={(e) => handleUpdateRole(m.user.id, e.target.value)}
                              className="bg-slate-950 border border-slate-850 text-slate-300 text-xs rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                            >
                              <option value="MEMBER">Membro</option>
                              <option value="CHECKER">Checker</option>
                              <option value="ORGANIZER">Organizador</option>
                              <option value="ADMIN">Administrador</option>
                              <option value="OWNER">Owner</option>
                            </select>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-350">
                              {m.role}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {hasPermission('members.delete') && (
                            <button
                              onClick={() => handleRemoveMember(m.user.id)}
                              className="text-red-500 hover:text-red-400 p-1.5 rounded hover:bg-red-950/20 transition-colors"
                              title="Remover Membro"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
