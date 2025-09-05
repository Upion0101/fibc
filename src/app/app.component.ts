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
    // Get the current session on load
    const { data } = await supabase.auth.getSession();
    this.user = data.session?.user || null;

    // Subscribe to auth state changes
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
