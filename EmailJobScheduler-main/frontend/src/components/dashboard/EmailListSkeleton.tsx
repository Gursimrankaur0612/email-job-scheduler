export function EmailListSkeleton() {
  return (
    <div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-gray-100" />
            </div>
            <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
