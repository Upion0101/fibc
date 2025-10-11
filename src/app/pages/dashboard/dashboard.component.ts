import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { supabase } from '../../../../supabaseClient';

interface DashboardCard {
  icon: string;
  label: string;
  count: number | null;
  link: string;
  description: string;
}

interface PendingUser {
  id: string;
  email: string;
  name: string | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  userName = 'Guest';
  role: 'pending' | 'member' | 'admin' = 'pending';

  cards: DashboardCard[] = [
    { icon: '🎵', label: 'Songs', count: null, link: '/songs', description: 'Manage all worship songs.' },
    { icon: '📋', label: 'Setlists', count: null, link: '/setlists', description: 'Organize song collections.' },
    { icon: '📅', label: 'Events', count: null, link: '/calendar', description: 'View and manage events.' },
    { icon: '👥', label: 'Members', count: null, link: '/members-admin', description: 'Manage worship team roster.' }
  ];

  nextEvent: {
    name: string;
    date: Date;
    time: string;
    type: string;
  } | null = null;

  statsLoading = true;
  eventLoading = true;

  pendingUsers: PendingUser[] = [];
  approving = false;

  async ngOnInit() {
    await this.loadUser();

    if (this.role !== 'pending') {
      await Promise.all([
        this.loadStats(),
        this.loadNextEvent()
      ]);
    }

    if (this.role === 'admin') {
      this.loadPendingUsers();
    }
  }

  // ===== Load user info =====
  private async loadUser() {
    try {
      await supabase.auth.refreshSession();

      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      if (!user) return;

      console.log('🔎 Authenticated user ID:', user.id);

      const { data: userRecord, error } = await supabase
        .from('users')
        .select('name, role, email')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      console.log('🧾 User record from DB:', userRecord);

      this.userName = userRecord?.name || user.email?.split('@')[0] || 'Guest';
      this.role = (userRecord?.role as 'pending' | 'member' | 'admin') || 'pending';

      console.log('✅ Role set to:', this.role);
    } catch (err) {
      console.error('Error loading user info:', err);
    }
  }

  // ===== Load dashboard stats =====
  private async loadStats() {
    this.statsLoading = true;
    try {
      const [setlists, events, users] = await Promise.all([
        supabase.from('setlists').select('*', { count: 'exact', head: true }),
        supabase.from('events').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true })  // 👈 now counts total members
      ]);

      this.cards = [
        { icon: '📋', label: 'Setlists', count: setlists.count ?? 0, link: '/setlists', description: 'Organize song collections.' },
        { icon: '📅', label: 'Events', count: events.count ?? 0, link: '/calendar', description: 'View and manage events.' },
        { icon: '👥', label: 'Members', count: users.count ?? 0, link: '/members-admin', description: 'Manage worship team roster.' },
        { icon: '🎵', label: 'Songs', count: null, link: '/songs', description: 'Manage all worship songs.' }
      ];

      // Load songs count separately (lazy)
      setTimeout(async () => {
        try {
          const { count } = await supabase
            .from('songs')
            .select('*', { count: 'exact', head: true });
          const i = this.cards.findIndex(c => c.label === 'Songs');
          if (i !== -1) this.cards[i].count = count ?? 0;
        } catch (err) {
          console.error('Error loading songs count:', err);
        }
      }, 200);
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      this.statsLoading = false;
    }
  }

  // ===== Load next upcoming event =====
  private async loadNextEvent() {
    this.eventLoading = true;
    try {
      const today = new Date().toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('events')
        .select('name, event_date, start_time, type')
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const e = data[0];
        const [year, month, day] = e.event_date.split('-').map(Number);
        const localDate = new Date(year, month - 1, day);

        this.nextEvent = {
          name: e.name,
          date: localDate,
          time: e.start_time || 'TBD',
          type: e.type || 'Service'
        };
      } else {
        this.nextEvent = null;
      }
    } catch (err) {
      console.error('Error loading next event:', err);
      this.nextEvent = null;
    } finally {
      this.eventLoading = false;
    }
  }

  // ===== ADMIN: Load pending users =====
  async loadPendingUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('role', 'pending');

      if (error) throw error;
      this.pendingUsers = data || [];
    } catch (err) {
      console.error('Error loading pending users:', err);
    }
  }

  // ===== ADMIN: Promote pending user =====
  async promoteToMember(id: string) {
    this.approving = true;
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: 'member' })
        .eq('id', id);

      if (error) throw error;
      this.pendingUsers = this.pendingUsers.filter(u => u.id !== id);
    } catch (err) {
      console.error('Error promoting user:', err);
    } finally {
      this.approving = false;
    }
  }
}
