import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { supabase } from '../../../../../supabaseClient';

@Component({
  selector: 'app-calendar-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar-detail.component.html',
  styleUrls: ['./calendar-detail.component.scss']
})
export class CalendarDetailComponent implements OnInit {
  event: any = { event_date: '', type: '', notes: '', setlist_id: null };
  isNew = true;
  setlists: any[] = [];
  members: any[] = [];
  assignedMemberIds: string[] = [];
  loading = true;

  constructor(private route: ActivatedRoute, private router: Router) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');

    const { data: setlists } = await supabase.from('setlists').select('id, name');
    this.setlists = setlists || [];

    const { data: members } = await supabase.from('members').select('id, name, role');
    this.members = members || [];

    if (id && id !== 'new') {
      this.isNew = false;
      const { data } = await supabase.from('events').select('*').eq('id', id).single();
      if (data) this.event = data;

      const { data: assigned } = await supabase
        .from('event_members')
        .select('member_id')
        .eq('event_id', id);

      this.assignedMemberIds = (assigned || []).map(a => a.member_id);
    }

    this.loading = false;
  }

  isMemberAssigned(memberId: string): boolean {
    return this.assignedMemberIds.includes(memberId);
  }

  toggleMember(memberId: string) {
    if (this.isMemberAssigned(memberId)) {
      this.assignedMemberIds = this.assignedMemberIds.filter(id => id !== memberId);
    } else {
      this.assignedMemberIds.push(memberId);
    }
  }

  async saveEvent() {
    const payload = {
      event_date: this.event.event_date,
      type: this.event.type,
      notes: this.event.notes,
      setlist_id: this.event.setlist_id,
      name: this.event.name,
      start_time: this.event.start_time,
      end_time: this.event.end_time
    };

    let result;
    if (this.isNew) {
      result = await supabase.from('events').insert([payload]).select('id').single();
      this.event.id = result.data?.id;
    } else {
      result = await supabase.from('events').update(payload).eq('id', this.event.id);
    }

    if (result.error) {
      console.error('❌ Error saving event:', result.error);
      return;
    }

    await supabase.from('event_members').delete().eq('event_id', this.event.id);
    const rows = this.assignedMemberIds.map(mid => ({ event_id: this.event.id, member_id: mid }));
    if (rows.length) await supabase.from('event_members').insert(rows);

    this.router.navigate(['/calendar']);
  }

  async deleteEvent() {
    if (!confirm('Are you sure you want to delete this event?')) return;

    const { error } = await supabase.from('events').delete().eq('id', this.event.id);

    if (error) {
      console.error('❌ Error deleting event:', error);
    } else {
      console.log(`✅ Event ${this.event.id} deleted`);
      this.router.navigate(['/calendar']);
    }
  }

  goBack() {
    this.router.navigate(['/calendar']);
  }
}
