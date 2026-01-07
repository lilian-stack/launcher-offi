import { useState, useEffect } from 'react'
import { FiUsers, FiLoader, FiTrash2, FiMail, FiUser } from 'react-icons/fi'

export function AdminUsersPage({ users, loading, onLoadUsers, onDeleteUser }) {
  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <FiUsers className="text-cyan-400" />
          Gestion des utilisateurs
        </h2>
        <p className="text-gray-400 text-sm">Gérer les utilisateurs et leurs permissions</p>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-gray-400">
            Total: <span className="text-white font-semibold">{users.length} utilisateur{users.length > 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={onLoadUsers}
            disabled={loading}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiLoader className={loading ? 'animate-spin' : ''} />
            Rafraîchir
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <FiLoader className="animate-spin text-cyan-400 text-4xl mx-auto mb-4" />
            <p className="text-gray-400">Chargement des utilisateurs...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <FiUsers className="text-gray-600 text-4xl mx-auto mb-4" />
            <p className="text-gray-400">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id || user.email}
                className="bg-gray-900 rounded-lg border border-gray-700 p-4 flex items-center justify-between hover:border-cyan-500/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 bg-cyan-500/20 rounded-full flex items-center justify-center">
                    <FiUser className="text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-medium">{user.username || user.name || 'Utilisateur sans nom'}</p>
                      {user.isAdmin && (
                        <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded border border-orange-500/30">
                          Admin
                        </span>
                      )}
                      {user.isVip && (
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded border border-purple-500/30">
                          VIP
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <FiMail className="text-xs" />
                        {user.email || 'Email non disponible'}
                      </span>
                      {user.id && (
                        <span className="text-xs font-mono text-gray-500">ID: {user.id}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onDeleteUser(user.id || user.email)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Supprimer l'utilisateur"
                >
                  <FiTrash2 />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

