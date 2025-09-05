import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { supabase } from './supabaseClient';

export const supabaseAuthGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const { data } = await supabase.auth.getSession();

  if (data.session?.user) {
    return true; // ✅ logged in
  } else {
    router.navigate(['/login']);
    return false;
  }
};
