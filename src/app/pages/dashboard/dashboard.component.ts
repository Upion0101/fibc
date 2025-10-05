import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { supabase } from '../../../../supabaseClient';

interface DashboardStat {
  icon: string;
  label: string;
  count: number | null;
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
  role = 'Member';

  stats: DashboardStat[] = [
    { icon: '🎵', label: 'Songs', count: null },
    { icon: '📋', label: 'Setlists', count: null },
    { icon: '📅', label: 'Events', count: null },
    { icon: '👥', label: 'Members', count: null }
  ];

  nextEvent: any = null;
  statsLoading = true;
  eventLoading = true;

  async ngOnInit() {
    this.loadUser();
    this.loadStats();
    this.loadNextEvent();
  }

  // ===== User info =====
  private async loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: member } = await supabase
        .from('members')
        .select('name, role')
        .eq('user_id', user.id)
        .maybeSingle();

      this.userName = member?.name || user.email?.split('@')[0] || 'Member';
      this.role = member?.role || 'Member';
    }
  }

  // ===== Stats =====
  private async loadStats() {
    this.statsLoading = true;
    try {
      const [songs, setlists, events, members] = await Promise.all([
        supabase.from('songs').select('*', { count: 'exact', head: true }),
        supabase.from('setlists').select('*', { count: 'exact', head: true }),
        supabase.from('events').select('*', { count: 'exact', head: true }),
        supabase.from('members').select('*', { count: 'exact', head: true })
      ]);

      this.stats = [
        { icon: '🎵', label: 'Songs', count: songs.count ?? 0 },
        { icon: '📋', label: 'Setlists', count: setlists.count ?? 0 },
        { icon: '📅', label: 'Events', count: events.count ?? 0 },
        { icon: '👥', label: 'Members', count: members.count ?? 0 }
      ];
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      this.statsLoading = false;
    }
  }

  // ===== Next event =====
  private async loadNextEvent() {
    this.eventLoading = true;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('events')
        .select('name, event_date, start_time, type')
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(1);

      if (data?.length) {
        const e = data[0];
        this.nextEvent = {
          name: e.name,
          date: new Date(e.event_date),
          time: e.start_time,
          type: e.type
        };
      } else {
        this.nextEvent = null;
      }
    } catch (err) {
      console.error('Error loading next event:', err);
    } finally {
      this.eventLoading = false;
    }
  }
}
