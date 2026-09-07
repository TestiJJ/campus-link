/**
 * LoadingSkeletons.jsx — CampusLink Route-Level Loading Skeletons
 *
 * Contextually-appropriate shimmer placeholders for each lazy-loaded route.
 * Used as Suspense fallbacks so users see a structural preview of the page
 * instead of a generic spinner.
 */

// Shimmer pulse utility — reusable class string
const shimmer = 'animate-pulse bg-slate-200 rounded-lg';

// ─── Shared primitives ────────────────────────────────────────────────────────

function SkeletonLine({ w = 'full', h = 3 }) {
  return <div className={`${shimmer} w-${w} h-${h}`} />;
}

function SkeletonAvatar({ size = 10 }) {
  return <div className={`${shimmer} rounded-full shrink-0`} style={{ width: size * 4, height: size * 4 }} />;
}

function SkeletonCard({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 ${className}`}>
      {children}
    </div>
  );
}

// ─── Dashboard Skeleton ────────────────────────────────────────────────────────

/**
 * Mimics the student dashboard header + tab bar + content feed.
 */
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top nav bar */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className={`${shimmer} h-8 w-32 rounded-full`} />
        <div className="flex gap-2">
          <div className={`${shimmer} h-8 w-8 rounded-full`} />
          <div className={`${shimmer} h-8 w-8 rounded-full`} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 flex gap-3 overflow-x-auto sticky top-14 z-40">
        {[72, 64, 80, 56, 68].map((w, i) => (
          <div key={i} className={`${shimmer} h-8 rounded-full shrink-0`} style={{ width: w }} />
        ))}
      </div>

      {/* Content cards */}
      <div className="flex-1 p-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* Hero card */}
        <SkeletonCard className="space-y-3">
          <div className="flex items-center gap-3">
            <SkeletonAvatar />
            <div className="flex-1 space-y-2">
              <SkeletonLine w="36" h={3} />
              <SkeletonLine w="24" h={2} />
            </div>
          </div>
          <div className={`${shimmer} h-48 w-full rounded-xl`} />
          <div className="flex gap-4">
            <SkeletonLine w="16" h={3} />
            <SkeletonLine w="16" h={3} />
          </div>
        </SkeletonCard>

        {/* Secondary cards */}
        {[1, 2].map(i => (
          <SkeletonCard key={i} className="space-y-3">
            <div className="flex items-center gap-3">
              <SkeletonAvatar size={9} />
              <div className="flex-1 space-y-2">
                <SkeletonLine w="32" h={3} />
                <SkeletonLine w="20" h={2} />
              </div>
            </div>
            <SkeletonLine w="full" h={3} />
            <SkeletonLine w="4/5" h={3} />
          </SkeletonCard>
        ))}
      </div>

      {/* Bottom nav bar */}
      <div className="bg-white border-t border-slate-100 px-6 py-3 flex justify-around sticky bottom-0">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className={`${shimmer} h-6 w-6 rounded-md`} />
            <div className={`${shimmer} h-2 w-10 rounded`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chat Skeleton ─────────────────────────────────────────────────────────────

/**
 * Mimics the messages tab with conversation list items.
 */
export function ChatSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-50 shadow-sm">
        <div className={`${shimmer} h-8 w-8 rounded-full`} />
        <div className={`${shimmer} h-6 w-28 rounded`} />
      </div>

      <div className="flex-1 divide-y divide-slate-100">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-white px-4 py-3 flex items-center gap-3">
            <SkeletonAvatar size={12} />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between">
                <SkeletonLine w="32" h={3} />
                <SkeletonLine w="10" h={2} />
              </div>
              <SkeletonLine w="48" h={2} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Vendor Skeleton ───────────────────────────────────────────────────────────

export function VendorSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className={`${shimmer} h-8 w-36 rounded-full`} />
        <div className={`${shimmer} h-8 w-8 rounded-full`} />
      </div>
      <div className="p-4 space-y-4 max-w-3xl mx-auto w-full">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <SkeletonCard key={i} className="space-y-2 text-center">
              <SkeletonLine w="full" h={6} />
              <SkeletonLine w="3/4" h={2} />
            </SkeletonCard>
          ))}
        </div>
        {/* Orders */}
        {[1, 2, 3].map(i => (
          <SkeletonCard key={i} className="space-y-2">
            <div className="flex justify-between">
              <SkeletonLine w="36" h={3} />
              <SkeletonLine w="16" h={3} />
            </div>
            <SkeletonLine w="full" h={2} />
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}

// ─── Admin Skeleton ────────────────────────────────────────────────────────────

export function AdminSkeleton() {
  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar */}
      <div className="w-60 bg-white border-r border-slate-200 p-4 space-y-3 hidden md:block shrink-0">
        <div className={`${shimmer} h-10 w-full rounded-xl`} />
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className={`${shimmer} h-8 w-full rounded-lg`} />
        ))}
      </div>
      {/* Main content */}
      <div className="flex-1 p-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <SkeletonCard key={i} className="space-y-2">
              <SkeletonLine w="full" h={6} />
              <SkeletonLine w="2/3" h={2} />
            </SkeletonCard>
          ))}
        </div>
        <SkeletonCard className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex gap-4">
              <SkeletonLine w="24" h={3} />
              <SkeletonLine w="32" h={3} />
              <SkeletonLine w="20" h={3} />
              <SkeletonLine w="16" h={3} />
            </div>
          ))}
        </SkeletonCard>
      </div>
    </div>
  );
}

// ─── Generic / Auth Skeleton ──────────────────────────────────────────────────

export function GenericPageSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md p-6 space-y-6">
        <div className={`${shimmer} h-12 w-2/3 mx-auto rounded-2xl`} />
        <div className={`${shimmer} h-48 w-full rounded-2xl`} />
        <div className={`${shimmer} h-12 w-full rounded-2xl`} />
      </div>
    </div>
  );
}
