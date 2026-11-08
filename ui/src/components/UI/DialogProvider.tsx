import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";

type DialogOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type DialogRequest = {
  kind: "confirm" | "alert";
  message: string;
  options: DialogOptions;
  resolve: (value: boolean) => void;
};

type DialogApi = {
  confirm: (message: string, options?: DialogOptions) => Promise<boolean>;
  alert: (message: string, options?: DialogOptions) => Promise<void>;
};

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error("useDialog must be used inside <DialogProvider>");
  return api;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);

  const open = useCallback(
    (
      kind: DialogRequest["kind"],
      message: string,
      options: DialogOptions = {},
    ) =>
      new Promise<boolean>((resolve) =>
        setRequest({ kind, message, options, resolve }),
      ),
    [],
  );

  const confirm = useCallback(
    (message: string, options?: DialogOptions) =>
      open("confirm", message, options),
    [open],
  );

  const alert = useCallback(
    async (message: string, options?: DialogOptions) => {
      await open("alert", message, options);
    },
    [open],
  );

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        request.resolve(false);
        setRequest(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request]);

  const close = (value: boolean) => {
    request?.resolve(value);
    setRequest(null);
  };

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}

      {request && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-dialog-title"
            className="w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)]"
          >
            <h2
              id="app-dialog-title"
              className="text-lg font-semibold text-body"
            >
              {request.options.title ??
                (request.kind === "confirm" ? "Confirm" : "Notice")}
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
              {request.message}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              {request.kind === "confirm" && (
                <button
                  onClick={() => close(false)}
                  className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-body transition-colors hover:border-accent hover:text-accent"
                >
                  {request.options.cancelLabel ?? "Cancel"}
                </button>
              )}
              <button
                autoFocus
                onClick={() => close(true)}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-[#1b1720] transition-colors hover:bg-accent-soft"
              >
                {request.options.confirmLabel ??
                  (request.kind === "confirm" ? "Confirm" : "OK")}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
