import { Component, Inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule, DOCUMENT } from '@angular/common';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  mobileMenuOpen = false;

  constructor(@Inject(DOCUMENT) public document: Document, public auth: AuthService) {}

  toggleMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMenu() {
    this.mobileMenuOpen = false;
  }

  logout() {
    this.auth.logout({
      logoutParams: {
        returnTo: this.document.location.origin
      }
    });
  }
}
