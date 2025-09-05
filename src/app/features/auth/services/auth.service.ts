import { Injectable } from '@angular/core';
import { supabase } from '../../../../../supabaseClient';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  async signUpWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  getSession() {
    return supabase.auth.getSession();
  }

  onAuthChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }

  // 👇 Add this method
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin // redirect back to your site
      }
    });
    if (error) throw error;
    return data;
  }
}
