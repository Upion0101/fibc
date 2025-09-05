import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { supabase } from '../../../../../supabaseClient';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar-detail.component.html',
  styleUrls: ['./calendar-detail.component.scss']
})
export class EventDetailComponent implements OnInit {
  event: any = null;
  setlists: any[] = [];
  members: any[] = [];
  assignments: any[] = [];
  loading = true;

  selectedSetlistId: string | null = null;
  selectedMemberId: string | null = null;
  selectedRole: string = '';

  constructor(private route: ActivatedRoute) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    // load event
    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (evErr) console.error(evErr);
    this.event = ev;

    // load setlists
    const { data: sets } = await supabase.from('setlists').select('id, name');
    this.setlists = sets || [];

    // load members
    const { data: mems } = await supabase.from('members').select('id, name');
    this.members = mems || [];

    // load assignments
    const { data: assigns } = await supabase
      .from('assignments')
      .select('id, role, member_id, members(name)')
      .eq('event_id', id);
    this.assignments = assigns || [];

    this.selectedSetlistId = this.event?.setlist_id || null;

    this.loading = false;
  }

  async updateSetlist() {
    if (!this.event?.id) return;
    const { error } = await supabase
      .from('events')
      .update({ setlist_id: this.selectedSetlistId })
      .eq('id', this.event.id);
    if (error) console.error('❌ Error updating setlist', error);
    else console.log('✅ Setlist updated');
  }

  async addAssignment() {
    if (!this.selectedMemberId || !this.selectedRole) return;

    const { error } = await supabase.from('assignments').insert({
      event_id: this.event.id,
      member_id: this.selectedMemberId,
      role: this.selectedRole
    });

    if (error) console.error(error);
    else this.ngOnInit(); // refresh
  }

  async removeAssignment(id: string) {
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    if (error) console.error(error);
    else this.assignments = this.assignments.filter(a => a.id !== id);
  }
}
