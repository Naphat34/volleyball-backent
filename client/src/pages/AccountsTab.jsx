import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
    Plus, Search, Edit2, Trash2, X, Save,
    User, Shield, Key, CheckCircle, AlertCircle, Loader2
} from 'lucide-react';

const AccountsTab = () => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
    const [selectedUser, setSelectedUser] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'user', // user, admin, staff
        status: 'active'
    });

    // Fetch Users
    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            // Assuming api is an axios instance or supports generic get
            const response = await api.getAllUsers();
            setUsers(response.data || []);
        } catch (error) {
            console.error("Failed to fetch users", error);
            // Fallback/Mock data for demonstration if backend isn't ready
            // setUsers([]); 
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Handlers
    const handleOpenModal = (mode, user = null) => {
        setModalMode(mode);
        setSelectedUser(user);
        if (mode === 'edit' && user) {
            setFormData({
                username: user.username,
                password: '', // Leave blank to keep unchanged
                role: user.role || 'user',
                status: user.status || 'active'
            });
        } else {
            setFormData({
                username: '',
                password: '',
                role: 'user',
                status: 'active'
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedUser(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (modalMode === 'create') {
                await api.createUser(formData);
            } else {
                const dataToSend = { ...formData };
                if (!dataToSend.password) delete dataToSend.password;
                await api.updateUser(selectedUser.id, dataToSend);
            }
            fetchUsers();
            handleCloseModal();
        } catch (error) {
            console.error("Operation failed", error);
            alert("Failed to save user. Please try again.");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this user?")) {
            try {
                await api.deleteUser(id);
                fetchUsers();
            } catch (error) {
                console.error("Delete failed", error);
            }
        }
    };

    // Filter users
    const filteredUsers = users.filter(user =>
        (user.username?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (user.team_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 rounded-lg shadow-sm transition-colors duration-200 bg-white text-gray-900">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <User className="text-blue-600" /> Accounts Management
                    </h2>
                    <p className="text-sm text-gray-500">
                        Manage user accounts, roles, and permissions.
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal('create')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                >
                    <Plus size={18} /> Add New User
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={18} className="text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder="Search users by username or team..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500"
                />
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200 text-gray-500">
                            <th className="p-4 font-medium">User</th>
                            <th className="p-4 font-medium">Role</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan="4" className="p-8 text-center">
                                    <div className="flex justify-center items-center gap-2 text-gray-500">
                                        <Loader2 className="animate-spin" /> Loading users...
                                    </div>
                                </td>
                            </tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="p-8 text-center text-gray-500">No users found.</td>
                            </tr>
                        ) : (
                            filteredUsers.map(user => (
                                <tr key={user.id} className="border-b last:border-0 transition-colors border-gray-100 hover:bg-gray-50">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-200">
                                                <User size={20} className="text-gray-500" />
                                            </div>
                                            <div>
                                                <div className="font-medium">{user.username}</div>
                                                <div className="text-sm text-gray-500">{user.team_name || '-'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                            ${user.role === 'admin'
                                                ? 'bg-purple-100 text-purple-800'
                                                : 'bg-blue-100 text-blue-800'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                            ${user.status === 'active'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                            }`}>
                                            {user.status === 'active' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => handleOpenModal('edit', user)} className="p-2 rounded-lg transition-colors hover:bg-gray-100 text-gray-600">
                                                <Edit2 size={18} />
                                            </button>
                                            <button onClick={() => handleDelete(user.id)} className="p-2 rounded-lg transition-colors hover:bg-red-50 text-red-600">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-md shadow-2xl transform transition-all bg-white text-gray-900">
                        <div className="flex justify-between items-center p-6 border-b border-gray-200">
                            <h3 className="text-xl font-bold">{modalMode === 'create' ? 'Add New User' : 'Edit User'}</h3>
                            <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div><label className="block text-sm font-medium mb-1">Username</label><div className="relative"><User className="absolute left-3 top-2.5 text-gray-400" size={18} /><input type="text" name="username" required value={formData.username} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 border-gray-300" placeholder="johndoe" /></div></div>
                            <div><label className="block text-sm font-medium mb-1">Password {modalMode === 'edit' && <span className="text-xs font-normal text-gray-500">(Leave blank to keep)</span>}</label><div className="relative"><Key className="absolute left-3 top-2.5 text-gray-400" size={18} /><input type="password" name="password" required={modalMode === 'create'} value={formData.password} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 border-gray-300" placeholder="••••••••" /></div></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium mb-1">Role</label><div className="relative"><Shield className="absolute left-3 top-2.5 text-gray-400" size={18} /><select name="role" value={formData.role} onChange={handleInputChange} className="w-full pl-10 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-gray-50 border-gray-300"><option value="user">User</option><option value="staff">Staff</option><option value="admin">Admin</option></select></div></div>
                                <div><label className="block text-sm font-medium mb-1">Status</label><select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 border-gray-300"><option value="active">Active</option><option value="inactive">Inactive</option><option value="banned">Banned</option></select></div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={handleCloseModal} className="px-4 py-2 rounded-lg font-medium transition-colors bg-gray-100 hover:bg-gray-200 text-gray-700">Cancel</button>
                                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"><Save size={18} /> {modalMode === 'create' ? 'Create User' : 'Save Changes'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccountsTab;
