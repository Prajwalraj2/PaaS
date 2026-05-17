import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">PaaS Platform</h1>
          <p className="text-muted-foreground mt-2">
            Deploy your applications with ease
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
