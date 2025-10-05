import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { provideAnimations } from '@angular/platform-browser/animations';
import { importProvidersFrom } from '@angular/core';
import { MarkdownModule } from 'ngx-markdown';
import { provideHttpClient } from '@angular/common/http';

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    // Keep existing appConfig providers
    ...(appConfig.providers || []),

    // ✅ Enable Angular animations globally (for @fadeUp, @fadeInHero, etc.)
    provideAnimations(),

    // ✅ Provide HttpClient (required for MarkdownModule & HTTP requests)
    provideHttpClient(),

    // ✅ Import MarkdownModule properly using importProvidersFrom
    importProvidersFrom(MarkdownModule.forRoot())
  ]
}).catch((err) => console.error(err));
