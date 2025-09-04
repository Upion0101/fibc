import { Routes } from '@angular/router';
import { AuthGuard } from '@auth0/auth0-angular';

export const routes: Routes = [
  // 🌐 Public pages
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./pages/about/about.component').then(m => m.AboutComponent)
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./pages/history/history.component').then(m => m.HistoryComponent)
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./pages/contact/contact.component').then(m => m.ContactComponent)
  },
  {
    path: 'visit',
    loadComponent: () =>
      import('./pages/visit/visit.component').then(m => m.VisitComponent)
  },
  {
    path: 'donate',
    loadComponent: () =>
      import('./pages/donate/donate.component').then(m => m.DonateComponent)
  },
  {
    path: 'gallery',
    loadComponent: () =>
      import('./pages/gallery/gallery.component').then(m => m.GalleryComponent)
  },

  // 🔐 Authentication
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },

  // 🔒 Protected pages
  {
    path: 'members',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./pages/members/members.component').then(m => m.MembersComponent)
  },
  {
    path: 'dashboard',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },

  // 🎵 Songs (protected)
  {
    path: 'songs/:id', // put dynamic first
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./features/songs/song-detail/song-detail.component').then(
        m => m.SongDetailComponent
      )
  },
  {
    path: 'songs',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./features/songs/song-catalog/song-catalog.component').then(
        m => m.SongCatalogComponent
      )
  },

  // ❌ Catch-all (404)
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then(
        m => m.NotFoundComponent
      )
  }
];
