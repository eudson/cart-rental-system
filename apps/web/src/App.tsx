import { Toaster } from '@/components/ui/sonner';

export default function App() {
  return (
    <>
      <div className="min-h-screen bg-[var(--color-background-subtle)] p-6">
        <h1>Golf Cart Rental Management</h1>
        <p className="mt-2 text-sm text-[var(--color-foreground-muted)]">
          Frontend foundation is configured and ready for page implementation.
        </p>
      </div>
      <Toaster richColors={false} position="bottom-right" visibleToasts={1} />
    </>
  );
}
