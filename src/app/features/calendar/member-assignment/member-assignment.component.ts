import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { supabase } from '../../../../../supabaseClient';

@Component({
  selector: 'app-member-assignment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './member-assignment.component.html',
  styleUrls: ['./member-assignment.component.scss']
})
export class MemberAssignmentComponent implements OnInit {
  @Input() eventId!: string;

  members: any[] = [];
  selectedMemberIds: string[] = [];
  loading = true;

  async ngOnInit() {
    await this.loadMembers();
    await this.loadAssignments();
  }

  async loadMembers() {
    const { data, error } = await supabase.from('members').select('*');
    if (error) console.error('❌ Error loading members:', error);
    this.members = data || [];
    this.loading = false;
  }

  async loadAssignments() {
    if (!this.eventId) return;
    const { data, error } = await supabase
      .from('event_members')
      .select('member_id')
      .eq('event_id', this.eventId);

    if (error) {
      console.error('❌ Error loading event assignments:', error);
      return;
    }

    this.selectedMemberIds = (data || []).map((d: any) => d.member_id);
  }

  async saveAssignments() {
    if (!this.eventId) return;

    // First clear existing assignments
    await supabase.from('event_members').delete().eq('event_id', this.eventId);

    // Insert new ones
    const inserts = this.selectedMemberIds.map(mid => ({
      event_id: this.eventId,
      member_id: mid
    }));

    const { error } = await supabase.from('event_members').insert(inserts);

    if (error) {
      console.error('❌ Error saving assignments:', error);
    } else {
      console.log('✅ Assignments saved');
    }
  }
}
