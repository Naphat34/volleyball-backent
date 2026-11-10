import useUiTranslation from '../../hooks/useUiTranslation';
import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import { Users, CheckCircle, XCircle } from 'lucide-react';
import { Toast, ActionButton, EmptyState } from './AdminShared';
import Swal from 'sweetalert2';

export default function PendingUsersTab() {
    const ui = useUiTranslation();
    const [pendingUsers, setPendingUsers] = useState([]);

    const fetchPendingUsers = useCallback(async () => {
        try {
            const res = await api.getPendingUsers();
            setPendingUsers(res.data);
        } catch (err) { console.error(err); }
    }, []);

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchPendingUsers();
        }, 0);
        return () => clearTimeout(timeout);
    }, [fetchPendingUsers]);

    const handleApprove = async (id, status) => {
        if (status === 'rejected') {
            const result = await Swal.fire({ uiTextLocalized: true,
                title: ui('Reject User?'),
                text: ui("Are you sure you want to reject this user?"),
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: ui('Yes, Reject')
            });
            if (!result.isConfirmed) return;
        }
        try {
            await api.approveUser(id, status);
            Toast.fire({ icon: 'success', title: status === 'active' ? 'User approved' : `User ${status}` });
            fetchPendingUsers();
        } catch (err) {
            console.error(err);
            Toast.fire({ icon: 'error', title: 'Action failed' });
        }
    };

    return (
        <div className="rounded-md shadow-sm border overflow-hidden bg-white border-gray-100">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50 border-gray-100">
                <h3 className="font-bold flex items-center gap-2">
                    <Users size={18} className="text-gray-400" />{ui("Pending Approvals")}</h3>
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-700">{pendingUsers.length}{' '}{ui("Requests")}</span>
            </div>
            {pendingUsers.length === 0 ? <EmptyState text="No pending requests." /> : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500">
                            <tr>
                                <th className="px-6 py-3 text-xs font-bold uppercase">{ui("User")}</th>
                                <th className="px-6 py-3 text-xs font-bold uppercase">{ui("Role")}</th>
                                <th className="px-6 py-3 text-xs font-bold uppercase">{ui("Team")}</th>
                                <th className="px-6 py-3 text-right text-xs font-bold uppercase">{ui("Action")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {pendingUsers.map(u => (
                                <tr key={u.id} className="transition hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium">{u.username} <span className="text-xs text-gray-400 block">{u.email}</span></td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold border border-blue-100">{ui(u.role)}</span></td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{u.name || '-'}</td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <ActionButton onClick={() => handleApprove(u.id, 'active')} color="green" icon={<CheckCircle size={16} />} label={ui("Approve")} />
                                        <ActionButton onClick={() => handleApprove(u.id, 'rejected')} color="red" icon={<XCircle size={16} />} label={ui("Reject")} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
