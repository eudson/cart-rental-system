import { toast } from 'sonner';

const SUCCESS_TOAST_DURATION_MS = 4000;
const ERROR_TOAST_DURATION_MS = 8000;

export function showSuccessToast(message: string): void {
  toast.success(message, { duration: SUCCESS_TOAST_DURATION_MS });
}

export function showErrorToast(message: string): void {
  toast.error(message, {
    duration: ERROR_TOAST_DURATION_MS,
    closeButton: true,
  });
}
