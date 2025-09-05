import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  constructor(public auth: AuthService) {
    // Save Auth0 token to localStorage for Supabase
    this.auth.idTokenClaims$.subscribe(claims => {
      if (claims && claims.__raw) {
        localStorage.setItem('auth0_access_token', claims.__raw);
      }
    });
  }

  login() {
    this.auth.loginWithRedirect({
      appState: { target: '/dashboard' } // 👈 redirect after login
    });
  }

  logout() {
    localStorage.removeItem('auth0_access_token'); // cleanup
    this.auth.logout({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
  }
}
