/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plus, X, Trash2, ShieldCheck } from 'lucide-react';
import type { RoleType } from '../../types';

export interface WorkspaceUserAccount {
  email: string;
  name?: string;
  role: RoleType;
  orgName?: string;
}

interface UsersManagementTabProps {
  accounts: WorkspaceUserAccount[];
  userEmail: string;
  isAddUserModalOpen: boolean;
  newUserName: string;
  newUserEmail: string;
  newUserRole: RoleType;
  newUserPassword: string;
  newUserOrg: string;
  onOpenAddUserModal: () => void;
  onCloseAddUserModal: () => void;
  onNewUserNameChange: (value: string) => void;
  onNewUserEmailChange: (value: string) => void;
  onNewUserRoleChange: (value: RoleType) => void;
  onNewUserPasswordChange: (value: string) => void;
  onNewUserOrgChange: (value: string) => void;
  onCreateUserAccount: (e: React.FormEvent) => void;
  onToggleUserRole: (email: string) => void;
  onDeleteUserAccount: (email: string) => void;
}

const PRIMARY_ADMIN_EMAILS = new Set(['saurabh.dey@irissoftware.com', 'saurabh.dey@kreosoftware.com']);

export default function UsersManagementTab({
  accounts,
  userEmail,
  isAddUserModalOpen,
  newUserName,
  newUserEmail,
  newUserRole,
  newUserPassword,
  newUserOrg,
  onOpenAddUserModal,
  onCloseAddUserModal,
  onNewUserNameChange,
  onNewUserEmailChange,
  onNewUserRoleChange,
  onNewUserPasswordChange,
  onNewUserOrgChange,
  onCreateUserAccount,
  onToggleUserRole,
  onDeleteUserAccount
}: UsersManagementTabProps) {
  return (
    <div className="flex flex-col gap-6" id="users-admin-workspace">
      {/* Overlay Modal for Adding Users */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
          isAddUserModalOpen ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'
        }`}
      >
        <div
          className={`relative bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl w-full max-w-md z-20 max-h-[95vh] overflow-y-auto transform transition-all duration-300 ${
            isAddUserModalOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
          }`}
        >
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
            <h3 className="text-xs font-mono uppercase tracking-widest text-indigo-600 flex items-center gap-2 font-bold">
              <Plus className="w-4 h-4" /> Add User Accounts
            </h3>
            <button
              type="button"
              onClick={onCloseAddUserModal}
              className="p-1 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={onCreateUserAccount} className="space-y-4 text-left">
            <div>
              <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Full Name</label>
              <input
                type="text"
                value={newUserName}
                onChange={(e) => onNewUserNameChange(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. Priyakant Sharma"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Corporate Email Address</label>
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => onNewUserEmailChange(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. p.sharma@irissoftware.com"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Assigned Domain Level</label>
              <div className="flex bg-slate-50 p-1 border border-slate-200 rounded-xl">
                <button
                  type="button"
                  onClick={() => onNewUserRoleChange('Recruiter')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold select-none transition-all ${
                    newUserRole === 'Recruiter'
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Recruiter
                </button>
                <button
                  type="button"
                  onClick={() => onNewUserRoleChange('Admin')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold select-none transition-all ${
                    newUserRole === 'Admin'
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Administrator
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Confidential Password</label>
              <input
                type="password"
                value={newUserPassword}
                onChange={(e) => onNewUserPasswordChange(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="Minimum 6 characters"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Designation</label>
              <input
                type="text"
                value={newUserOrg}
                onChange={(e) => onNewUserOrgChange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. Senior Recruiter"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors mt-2 shadow-sm shadow-indigo-600/10 cursor-pointer"
              id="create-user-submit-btn"
            >
              <Plus className="w-3.5 h-3.5" /> Initialize Corporate Account
            </button>
          </form>
        </div>

        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-10 transition-opacity"
          onClick={onCloseAddUserModal}
        />
      </div>

      {/* Registered Enterprise Personnel Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Registered Enterprise Personnel</h2>
            <p className="text-xs text-slate-500 mt-1">
              Manage workspace users database. Active Administrators can demote/promote users dynamically, granting them Recruiter status or Full-Stack Admin access.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAddUserModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm shadow-indigo-600/10 cursor-pointer shrink-0"
            id="open-add-user-modal-btn"
          >
            <Plus className="w-4 h-4" /> Add User Accounts
          </button>
        </div>

        <div className="mt-6 overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                <th className="p-4 font-bold">User / Identity</th>
                <th className="p-4 font-bold">Designation</th>
                <th className="p-4 font-bold">Domain Level</th>
                <th className="p-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {accounts.map((acc, index) => {
                const isPrimaryAdmin = PRIMARY_ADMIN_EMAILS.has(acc.email.toLowerCase());
                const isSelf = acc.email.toLowerCase() === userEmail.toLowerCase();
                return (
                  <tr key={acc.email || index} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-slate-900">{acc.name || 'kreo Software Workspace Associate'}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{acc.email}</div>
                    </td>
                    <td className="p-4 text-slate-700">{acc.orgName || 'Technical Consultant'}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold font-mono rounded-lg border ${
                          acc.role === 'Admin'
                            ? 'bg-indigo-50 text-indigo-755 border-indigo-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {acc.role === 'Admin' ? 'Administrator' : 'Recruiter'}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => onToggleUserRole(acc.email)}
                        disabled={isPrimaryAdmin || isSelf}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all ${
                          isPrimaryAdmin || isSelf
                            ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-60'
                            : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-indigo-650 border-slate-200 cursor-pointer'
                        }`}
                        title={
                          isPrimaryAdmin
                            ? 'Primary admin cannot be dynamically demoted'
                            : isSelf
                              ? 'You cannot alter your own active level'
                              : 'Toggle between Recruiter and Admin levels'
                        }
                      >
                        Toggle Role
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteUserAccount(acc.email)}
                        disabled={isPrimaryAdmin || isSelf}
                        className={`p-1.5 rounded-lg border transition-all ${
                          isPrimaryAdmin || isSelf
                            ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-60'
                            : 'bg-red-55 hover:bg-red-100 text-red-650 border-red-100 cursor-pointer'
                        }`}
                        title={
                          isPrimaryAdmin
                            ? 'Primary admin cannot be deleted'
                            : isSelf
                              ? 'You cannot delete yourself in active session'
                              : 'Remove associate account'
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-4.5 bg-indigo-50/20 border border-indigo-100 rounded-xl flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-slate-900">Security Access Governance Directive</p>
            <p className="text-[10px] text-slate-550 leading-relaxed mt-0.5">
              Administrators can dynamically override any registered workspace user domains under local database boundaries. Only authorized accounts are enabled to synthesize client JDs, compile candidate reports, or configure live proctored logs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
