import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PageErrorProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function PageError({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Retry',
}: PageErrorProps) {
  return (
    <Card className="border border-border bg-background shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-medium text-foreground">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4 pt-0">
        <p className="text-sm text-muted-foreground">{message}</p>
        {onRetry ? (
          <Button type="button" variant="outline" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
