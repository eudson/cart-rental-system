import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { LoginRequestDto } from 'shared';
import { UserRole } from 'shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiClientError } from '@/services/api-client';
import { loginCustomer, loginStaff } from '@/services/auth-service';
import { parseAccessTokenClaims } from '@/services/auth-token';
import { useAuthStore } from '@/store/auth-store';

type LoginVariant = 'staff' | 'customer';

interface LoginPageConfig {
  variant: LoginVariant;
  title: string;
  description: string;
  submitLabel: string;
}

type LoginFormErrors = Partial<Record<keyof LoginRequestDto, string>>;

function getDefaultRouteForVariant(variant: LoginVariant): string {
  return variant === 'customer' ? '/portal/rentals' : '/dashboard';
}

function isAllowedRedirectPath(path: string, variant: LoginVariant): boolean {
  if (variant === 'customer') {
    return path.startsWith('/portal/');
  }

  return !path.startsWith('/portal/');
}

function resolveRedirectPath(
  variant: LoginVariant,
  role: UserRole | 'customer',
  requestedPath: string | undefined,
): string {
  if (variant === 'customer' && role !== 'customer') {
    return '/login';
  }

  if (variant === 'staff' && role === 'customer') {
    return '/portal/login';
  }

  if (requestedPath && isAllowedRedirectPath(requestedPath, variant)) {
    return requestedPath;
  }

  return getDefaultRouteForVariant(variant);
}

function validateForm(values: LoginRequestDto): LoginFormErrors {
  const errors: LoginFormErrors = {};

  if (!values.organizationSlug.trim()) {
    errors.organizationSlug = 'Organization slug is required.';
  }

  if (!values.email.trim()) {
    errors.email = 'Email is required.';
  }

  if (!values.password) {
    errors.password = 'Password is required.';
  }

  return errors;
}

function LoginPage({ variant, title, description, submitLabel }: LoginPageConfig) {
  const navigate = useNavigate();
  const location = useLocation();
  const setTokenSession = useAuthStore((state) => state.setTokenSession);
  const [formValues, setFormValues] = useState<LoginRequestDto>({
    organizationSlug: '',
    email: '',
    password: '',
  });
  const [formErrors, setFormErrors] = useState<LoginFormErrors>({});
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: (payload: LoginRequestDto) =>
      variant === 'staff' ? loginStaff(payload) : loginCustomer(payload),
    onSuccess: (response) => {
      const claims = parseAccessTokenClaims(response.accessToken);
      if (!claims) {
        const message = 'Login succeeded, but session claims were invalid. Please log in again.';
        setFormErrorMessage(message);
        toast.error(message, { duration: 8000, closeButton: true });
        return;
      }

      if (variant === 'staff' && claims.role === 'customer') {
        const message = 'Customer credentials cannot access the staff application.';
        setFormErrorMessage(message);
        toast.error(message, { duration: 8000, closeButton: true });
        return;
      }

      if (variant === 'customer' && claims.role !== 'customer') {
        const message = 'Staff credentials must use the staff/admin login route.';
        setFormErrorMessage(message);
        toast.error(message, { duration: 8000, closeButton: true });
        return;
      }

      setFormErrorMessage(null);
      setTokenSession({
        sessionType: variant,
        sessionRole: claims.role,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });

      const requestedPath =
        (location.state as { from?: string } | null)?.from?.trim() || undefined;
      const redirectPath = resolveRedirectPath(variant, claims.role, requestedPath);

      navigate(redirectPath, { replace: true });
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.statusCode === 401) {
        const message =
          'Invalid credentials. Please verify your email, password, and organization slug.';
        setFormErrorMessage(message);
        toast.error(message, { duration: 8000, closeButton: true });
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Login failed. Please try again in a moment.';
      setFormErrorMessage(message);
      toast.error(message, { duration: 8000, closeButton: true });
    },
  });

  function updateField<Key extends keyof LoginRequestDto>(field: Key, value: LoginRequestDto[Key]) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));

    if (formErrors[field]) {
      setFormErrors((currentErrors) => ({
        ...currentErrors,
        [field]: undefined,
      }));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateForm(formValues);
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    setFormErrors({});
    setFormErrorMessage(null);
    loginMutation.mutate({
      organizationSlug: formValues.organizationSlug.trim(),
      email: formValues.email.trim(),
      password: formValues.password,
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-subtle)] px-6 py-10">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label
              htmlFor={`${variant}-organization-slug`}
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Organization Slug *
            </label>
            <Input
              id={`${variant}-organization-slug`}
              autoComplete="organization"
              value={formValues.organizationSlug}
              onChange={(event) => updateField('organizationSlug', event.target.value)}
              aria-invalid={Boolean(formErrors.organizationSlug)}
              disabled={loginMutation.isPending}
            />
            {formErrors.organizationSlug ? (
              <p className="text-xs text-destructive">{formErrors.organizationSlug}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`${variant}-email`}
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Email *
            </label>
            <Input
              id={`${variant}-email`}
              type="email"
              autoComplete="email"
              value={formValues.email}
              onChange={(event) => updateField('email', event.target.value)}
              aria-invalid={Boolean(formErrors.email)}
              disabled={loginMutation.isPending}
            />
            {formErrors.email ? <p className="text-xs text-destructive">{formErrors.email}</p> : null}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`${variant}-password`}
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Password *
            </label>
            <Input
              id={`${variant}-password`}
              type="password"
              autoComplete="current-password"
              value={formValues.password}
              onChange={(event) => updateField('password', event.target.value)}
              aria-invalid={Boolean(formErrors.password)}
              disabled={loginMutation.isPending}
            />
            {formErrors.password ? (
              <p className="text-xs text-destructive">{formErrors.password}</p>
            ) : null}
          </div>

          {formErrorMessage ? <p className="text-xs text-destructive">{formErrorMessage}</p> : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function StaffLoginPage() {
  return (
    <LoginPage
      variant="staff"
      title="Staff/Admin Login"
      description="Sign in to manage carts, rentals, customers, and payments."
      submitLabel="Sign In"
    />
  );
}

export function CustomerLoginPage() {
  return (
    <LoginPage
      variant="customer"
      title="Customer Portal Login"
      description="Sign in to view your rentals, lease contract, and payment history."
      submitLabel="Open Portal"
    />
  );
}
