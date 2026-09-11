export interface ToastState {
  type: "success" | "error";
  message: string;
}

export function Toast({ toast }: { toast: ToastState }) {
  const isSuccess = toast.type === "success";

  return (
    <div
      role="status"
      className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
        isSuccess ? "bg-green-600 text-white" : "bg-red-600 text-white"
      }`}
    >
      {toast.message}
    </div>
  );
}
