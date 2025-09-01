import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { AboutComponent } from './pages/about/about.component';
import { HistoryComponent } from './pages/history/history.component';
import { MembersComponent } from './pages/members/members.component';
import { ContactComponent } from './pages/contact/contact.component';
import { VisitComponent } from './pages/visit/visit.component';
import { DonateComponent } from './pages/donate/donate.component';
import { GalleryComponent } from './pages/gallery/gallery.component'; 
import { NotFoundComponent } from './pages/not-found/not-found.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'about', component: AboutComponent },
  { path: 'history', component: HistoryComponent },
  { path: 'members', component: MembersComponent },
  { path: 'contact', component: ContactComponent },
  { path: 'visit', component: VisitComponent },
  { path: 'donate', component: DonateComponent },
  { path: 'gallery', component: GalleryComponent },
  { path: '**', component: NotFoundComponent }
];
