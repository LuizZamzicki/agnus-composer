import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "../css/notification.css";

const NotificationContext = createContext(null);
const DEFAULT_DURATION = 4200;

const TYPE_CONFIG = {
  success: {
    className: "success",
    icon: CheckCircle2,
    title: "Sucesso",
  },
  error: {
    className: "error",
    icon: AlertCircle,
    title: "Erro",
  },
  info: {
    className: "info",
    icon: Info,
    title: "Informacao",
  },
  warning: {
    className: "warning",
    icon: TriangleAlert,
    title: "Atencao",
  },
};

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const timeoutMapRef = useRef(new Map());
  const confirmResolverRef = useRef(null);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));

    const timeoutId = timeoutMapRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutMapRef.current.delete(id);
    }
  }, []);

  const closeConfirmDialog = useCallback((result) => {
    setConfirmDialog(null);
    const resolver = confirmResolverRef.current;
    if (resolver) {
      confirmResolverRef.current = null;
      resolver(Boolean(result));
    }
  }, []);

  const openConfirmDialog = useCallback((options = {}) => {
    return new Promise((resolve) => {
      const resolverAnterior = confirmResolverRef.current;
      if (resolverAnterior) {
        resolverAnterior(false);
      }

      confirmResolverRef.current = resolve;
      setConfirmDialog({
        title: options.title || "Confirmar acao",
        message: options.message || "Deseja continuar com esta acao?",
        confirmText: options.confirmText || "Confirmar",
        cancelText: options.cancelText || "Cancelar",
        tone: options.tone === "danger" ? "danger" : "default",
      });
    });
  }, []);

  const pushNotification = useCallback(
    (message, options = {}) => {
      if (!message) return null;

      const type = TYPE_CONFIG[options.type] ? options.type : "info";
      const config = TYPE_CONFIG[type];
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      setNotifications((prev) => [
        ...prev,
        {
          id,
          type,
          title: options.title || config.title,
          message,
        },
      ]);

      const duration =
        Number.isFinite(options.duration) && options.duration >= 0
          ? options.duration
          : DEFAULT_DURATION;

      if (duration > 0) {
        const timeoutId = window.setTimeout(() => removeNotification(id), duration);
        timeoutMapRef.current.set(id, timeoutId);
      }

      return id;
    },
    [removeNotification]
  );

  useEffect(() => {
    const timeoutMap = timeoutMapRef.current;
    return () => {
      timeoutMap.forEach((timeoutId) => clearTimeout(timeoutId));
      timeoutMap.clear();
      const resolver = confirmResolverRef.current;
      if (resolver) {
        confirmResolverRef.current = null;
        resolver(false);
      }
    };
  }, []);

  const notificationApi = useMemo(
    () => ({
      show: (message, options) => pushNotification(message, options),
      success: (message, options) => pushNotification(message, { ...options, type: "success" }),
      error: (message, options) => pushNotification(message, { ...options, type: "error" }),
      info: (message, options) => pushNotification(message, { ...options, type: "info" }),
      warning: (message, options) => pushNotification(message, { ...options, type: "warning" }),
      confirm: (options) => openConfirmDialog(options),
      remove: removeNotification,
    }),
    [openConfirmDialog, pushNotification, removeNotification]
  );

  return (
    <NotificationContext.Provider value={notificationApi}>
      {children}

      <div className="app-toast-container" aria-live="polite" aria-atomic="false">
        {notifications.map((notification) => {
          const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.info;
          const Icon = config.icon;

          return (
            <article
              key={notification.id}
              className={`app-toast app-toast--${config.className}`}
              role="status"
            >
              <span className="app-toast__icon" aria-hidden="true">
                <Icon size={18} />
              </span>

              <div className="app-toast__content">
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
              </div>

              <button
                type="button"
                className="app-toast__close"
                onClick={() => removeNotification(notification.id)}
                aria-label="Fechar notificacao"
              >
                <X size={16} />
              </button>
            </article>
          );
        })}
      </div>

      {confirmDialog && (
        <div className="app-confirm-overlay" role="presentation" onClick={() => closeConfirmDialog(false)}>
          <div
            className="app-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label={confirmDialog.title}
            onClick={(event) => event.stopPropagation()}
          >
            <span className="app-confirm-modal__icon" aria-hidden="true">
              <TriangleAlert size={20} />
            </span>
            <h3>{confirmDialog.title}</h3>
            <p>{confirmDialog.message}</p>

            <div className="app-confirm-modal__actions">
              <button type="button" className="app-confirm-btn app-confirm-btn--secondary" onClick={() => closeConfirmDialog(false)}>
                {confirmDialog.cancelText}
              </button>
              <button
                type="button"
                className={`app-confirm-btn ${
                  confirmDialog.tone === "danger"
                    ? "app-confirm-btn--danger"
                    : "app-confirm-btn--primary"
                }`}
                onClick={() => closeConfirmDialog(true)}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification deve ser usado dentro de NotificationProvider.");
  }
  return context;
}
