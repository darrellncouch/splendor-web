import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { ART, BUNDLED_ART } from '@shared/art';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    { provide: ART, useValue: BUNDLED_ART }, // full-size art from ../public/art
  ],
};
