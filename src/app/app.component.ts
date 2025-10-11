import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './core/header/header.component';
import { FooterComponent } from './core/footer/footer.component';
import { supabase } from '../../supabaseClient';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  user: any = null;

  async ngOnInit() {
    // Get session
    const { data: { session } } = await supabase.auth.getSession();
    this.user = session?.user || null;

    if (this.user) {
      console.log('✅ Supabase user logged in:', this.user.email);

      // 🔄 Force refresh to ensure JWT has latest DB role claims
      try {
        const { data: refreshed, error } = await supabase.auth.refreshSession();
        if (error) console.error('Session refresh error:', error);
        else if (refreshed?.session) {
          this.user = refreshed.session.user;
          console.log('🔄 Session refreshed successfully.');
        }
      } catch (err) {
        console.error('Unexpected refresh error:', err);
      }
    } else {
      console.log('❌ Supabase user logged out');
    }

    // Subscribe to future auth state changes
    supabase.auth.onAuthStateChange((_event, session) => {
      this.user = session?.user || null;

      if (this.user) {
        console.log('✅ Supabase user logged in:', this.user.email);
      } else {
        console.log('❌ Supabase user logged out');
      }
    });
  }
}
