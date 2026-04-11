import { AppProviders } from '@/providers/app-providers';
import { AppRouter } from '@/router/app-router';
import { Toaster } from '@/components/ui/sonner';

export default function App() {
  return (
    <AppProviders>
      <AppRouter />
      <Toaster richColors={false} position="bottom-right" visibleToasts={1} />
    </AppProviders>
  );
}
