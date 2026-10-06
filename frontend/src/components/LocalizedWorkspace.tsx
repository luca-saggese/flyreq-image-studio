'use client';

import { LanguageProvider } from '@/components/LanguageProvider';
import { BrandProvider } from '@/components/BrandProvider';
import { AuthGate } from '@/components/AuthGate';
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell';
import type { Locale } from '@/lib/i18n';

export function LocalizedWorkspace({ initialLocale }: { initialLocale: Locale }) {
  return (
    <LanguageProvider initialLocale={initialLocale}>
      <BrandProvider>
        <AuthGate>
          <WorkspaceShell />
        </AuthGate>
      </BrandProvider>
    </LanguageProvider>
  );
}

