import { Component, Inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule, DOCUMENT } from '@angular/common';
import { supabase } from '../../../../supabaseClient';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  mobileMenuOpen = false;
  user: any = null;

  constructor(@Inject(DOCUMENT) public document: Document) {
    // Load current user once
    supabase.auth.getUser().then(({ data }) => {
      this.user = data.user;
    });

    // Subscribe to auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      this.user = session?.user || null;
    });
  }

  toggleMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMenu() {
    this.mobileMenuOpen = false;
  }

  async logout() {
    await supabase.auth.signOut();
    this.document.location.href = '/';
  }
}
