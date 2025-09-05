import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { HeaderComponent } from './core/header/header.component';
import { FooterComponent } from './core/footer/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  constructor(public auth: AuthService) {}

  ngOnInit() {
    this.auth.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.auth.getAccessTokenSilently().subscribe(token => {
          if (token) {
            localStorage.setItem('auth0_access_token', token);
            console.log('✅ Auth0 token saved for Supabase:', token.substring(0, 20) + '...');
          }
        });
      } else {
        localStorage.removeItem('auth0_access_token');
      }
    });
  }
}
