'use client';
import { ShieldOff } from 'lucide-react';
import { useCommercialAccess } from '@/lib/use-commercial-access';

export function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-60 gap-3">
      <ShieldOff size={36} className="text-gray-300" />
      <p className="text-gray-500 font-medium text-center max-w-md">{message}</p>
    </div>
  );
}

export function CommercialOnly({ children }: { children: React.ReactNode }) {
  const { allowed, isLoading } = useCommercialAccess();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <AccessDenied message="Clients and newsletters are only available to Marketing and Product Management." />
    );
  }

  return <>{children}</>;
}
