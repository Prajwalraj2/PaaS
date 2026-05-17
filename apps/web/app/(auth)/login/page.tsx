import { LoginForm } from '@/components/auth/login-form';

export const metadata = {
  title: 'Login - PaaS Platform',
  description: 'Sign in to your PaaS account',
};

export default function LoginPage() {
  return <LoginForm />;
}
