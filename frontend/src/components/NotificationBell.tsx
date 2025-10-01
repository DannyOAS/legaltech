import { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { api } from "../lib/api";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
  notification_type: string;
}

interface NotificationStats {
  total: number;
  unread: number;
  unread_by_type: Record<string, number>;
}

const fetcher = <T,>(url: string) => api.get<T>(url);

const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: notifications } = useSWR<{ results: NotificationItem[] }>("/notifications/?read=false", fetcher, { 
    refreshInterval: 30000,
    revalidateOnFocus: true 
  });
  const { data: stats } = useSWR<NotificationStats>("/notifications/stats/", fetcher, { refreshInterval: 30000 });
  
  const unreadCount = stats?.unread ?? 0;
  const recentNotifications = useMemo(() => notifications?.results?.slice(0, 5) ?? [], [notifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      await api.post(`/notifications/${notificationId}/read/`);
      // Refresh both endpoints
      mutate("/notifications/?read=false");
      mutate("/notifications/stats/");
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post("/notifications/mark-all-read/");
      mutate("/notifications/?read=false");
      mutate("/notifications/stats/");
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "billing.invoice.created":
        return "💰";
      case "portal.document.shared":
        return "📄";
      case "portal.message.sent":
        return "💬";
      case "mfa.enforcement_applied":
        return "🔒";
      default:
        return "📋";
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M14.857 17.657A2 2 0 0113 19H11a2 2 0 01-1.857-1.343L8 15h8l-1.143 2.657z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M18 8a6 6 0 10-12 0c0 2.577-.368 4.07-1.145 5.325-.435.724-.653 1.086-.64 1.33.015.284.161.54.403.697C5.054 15.5 6.486 15.5 9.35 15.5h5.3c2.864 0 4.295 0 4.732-.148.242-.158.388-.413.403-.697.013-.244-.205-.606-.64-1.33C18.368 12.07 18 10.577 18 8z"
          />
        </svg>
      </button>
      
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-xs text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-10 z-20 w-80 max-w-sm rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-primary-600 hover:text-primary-500"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              
              {recentNotifications.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No new notifications</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        notification.read_at ? "bg-gray-50 border-gray-200" : "bg-blue-50 border-blue-200"
                      }`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <span className="text-lg">{getNotificationIcon(notification.notification_type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {notification.title}
                          </p>
                          {notification.body && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {notification.body}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {formatTimeAgo(notification.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {unreadCount > 5 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-center text-sm text-gray-500">
                    {unreadCount - 5} more unread notifications
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
