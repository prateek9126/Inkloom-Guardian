import React, { createContext, useContext, useState } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
}

interface NotificationContextType {
  notify: (message: string, type?: NotificationType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const remove = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const notify = (message: string, type: NotificationType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications(prev => [...prev, { id, type, message }]);

    setTimeout(() => {
      remove(id);
    }, 4500);
  };

  const success = (message: string) => notify(message, 'success');
  const error = (message: string) => notify(message, 'error');
  const info = (message: string) => notify(message, 'info');

  return (
    <NotificationContext.Provider value={{ notify, success, error, info }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 max-w-md w-full px-4 pointer-events-none">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`pointer-events-auto flex items-start p-3.5 rounded-md border shadow-md transition-all ${
              n.type === 'success'
                ? 'bg-white border-emerald-300 text-slate-800'
                : n.type === 'error'
                ? 'bg-white border-red-300 text-slate-800'
                : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            <div className="flex-shrink-0 mr-3 mt-0.5">
              {n.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
              {n.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
              {n.type === 'info' && <Info className="w-5 h-5 text-sky-600" />}
            </div>
            <div className="flex-1 text-sm font-medium leading-5">{n.message}</div>
            <button
              onClick={() => remove(n.id)}
              className="ml-3 flex-shrink-0 text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
