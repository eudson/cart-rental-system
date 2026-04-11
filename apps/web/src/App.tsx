import { AppRouter } from '@/router/app-router';
import { Toaster } from '@/components/ui/sonner';

export default function App() {
  return (
    <>
      <AppRouter />
      <Toaster richColors={false} position="bottom-right" visibleToasts={1} />
    </>
  );
}
