import type { KeyboardEvent, ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-gray-100">{children}</div>;
}

interface TableRowProps {
  children: ReactNode;
  onClick?: () => void;
}

export function TableRow({ children, onClick }: TableRowProps) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  }

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`flex items-center gap-4 px-5 py-4 transition hover:bg-gray-50 ${onClick ? "cursor-pointer" : ""}`}
    >
      {children}
    </div>
  );
}
