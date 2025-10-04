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
    ...(appConfig.providers || []),

    // ✅ Enable Angular animations
    provideAnimations(),

    // ✅ Provide HttpClient (required by MarkdownModule)
    provideHttpClient(),

    // ✅ Register MarkdownModule globally (fixes _MarkdownService error)
    importProvidersFrom(MarkdownModule.forRoot())
  ]
}).catch(err => console.error(err));
