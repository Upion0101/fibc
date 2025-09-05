import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  email = '';
  password = '';
  message = '';

  constructor(private auth: AuthService) {}

  async login() {
    try {
      await this.auth.signInWithEmail(this.email, this.password);
      this.message = 'Logged in!';
    } catch (err: any) {
      this.message = err.message;
    }
  }

  async signup() {
    try {
      await this.auth.signUpWithEmail(this.email, this.password);
      this.message = 'Check your email to confirm.';
    } catch (err: any) {
      this.message = err.message;
    }
  }

  async loginGoogle() {
    try {
      await this.auth.signInWithGoogle();
      // Supabase will handle redirect
    } catch (err: any) {
      this.message = err.message;
    }
  }

  async logout() {
    await this.auth.signOut();
    this.message = 'Logged out';
  }
}
