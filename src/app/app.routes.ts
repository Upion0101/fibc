import { Routes } from '@angular/router';
import { supabaseAuthGuard } from '../../supabase-auth.guard';

export const routes: Routes = [
  // 🌐 Public pages
  { path: '', loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent) },
  { path: 'about', loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent) },
  { path: 'history', loadComponent: () => import('./pages/history/history.component').then(m => m.HistoryComponent) },
  { path: 'contact', loadComponent: () => import('./pages/contact/contact.component').then(m => m.ContactComponent) },
  { path: 'visit', loadComponent: () => import('./pages/visit/visit.component').then(m => m.VisitComponent) },
  { path: 'donate', loadComponent: () => import('./pages/donate/donate.component').then(m => m.DonateComponent) },
  { path: 'gallery', loadComponent: () => import('./pages/gallery/gallery.component').then(m => m.GalleryComponent) },

  // 🔐 Authentication
  { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },

  // 👥 Public-facing Members page
  { path: 'members', loadComponent: () => import('./pages/members/members.component').then(m => m.MembersComponent) },

  // 🔒 Private Members management (Supabase-driven)
  { path: 'members-admin', canActivate: [supabaseAuthGuard], loadComponent: () => import('./features/members/members/members.component').then(m => m.MembersComponent) },

  // 🔒 Dashboard
  { path: 'dashboard', canActivate: [supabaseAuthGuard], loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },

  // 🎵 Songs
  { path: 'songs/:id', canActivate: [supabaseAuthGuard], loadComponent: () => import('./features/songs/song-detail/song-detail.component').then(m => m.SongDetailComponent) },
  { path: 'songs', canActivate: [supabaseAuthGuard], loadComponent: () => import('./features/songs/song-catalog/song-catalog.component').then(m => m.SongCatalogComponent) },

  // 📋 Setlists
  { path: 'setlists', canActivate: [supabaseAuthGuard], loadComponent: () => import('./pages/setlists/setlist-list/setlist-list.component').then(m => m.SetlistListComponent) },
  { path: 'setlists/:id', canActivate: [supabaseAuthGuard], loadComponent: () => import('./pages/setlists/setlist-detail/setlist-detail.component').then(m => m.SetlistDetailComponent) },

  // 📅 Calendar
  { path: 'calendar', canActivate: [supabaseAuthGuard], loadComponent: () => import('./features/calendar/calendar/calendar.component').then(m => m.CalendarComponent) },
  { path: 'calendar/:id', canActivate: [supabaseAuthGuard], loadComponent: () => import('./features/calendar/calendar-detail/calendar-detail.component').then(m => m.CalendarDetailComponent) },

  // ❌ Catch-all (404)
  { path: '**', loadComponent: () => import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent) }
];
