import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { supabase } from '../../../../../supabaseClient';

@Component({
  selector: 'app-members-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './members.component.html',
  styleUrls: ['./members.component.scss']
})
export class MembersComponent implements OnInit {
  users: any[] = [];
  pendingUsers: any[] = [];
  activeUsers: any[] = [];
  currentUser: any = null;
  loading = true;
  userId: string | null = null;
  isAdmin = false;

  // ===== Computed getters for counts =====
  get adminCount(): number {
    return this.activeUsers.filter(u => u.role === 'admin').length;
  }
  get memberCount(): number {
    return this.activeUsers.filter(u => u.role === 'member').length;
  }

  async ngOnInit() {
    await this.loadCurrentUser();
    await this.loadUsers();
  }

  // ===== Load Current Authenticated User =====
  async loadCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      console.warn('⚠️ No logged-in user or auth error:', error);
      return;
    }

    this.userId = user.id;

    const { data, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (userError) console.error('❌ Error loading current user:', userError);
    this.currentUser = data;
    this.isAdmin = data?.role?.toLowerCase() === 'admin';
  }

  // ===== Load All Users =====
  async loadUsers() {
    this.loading = true;

    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error loading users:', error);
      this.users = [];
      this.loading = false;
      return;
    }

    this.users = data || [];
    this.pendingUsers = this.users.filter(u => u.role === 'pending');
    this.activeUsers = this.users.filter(u => ['member', 'admin'].includes(u.role));
    this.loading = false;
  }

  // ===== Edit User =====
  async editUser(userRecord: any) {
    const canEdit = this.isAdmin || userRecord.id === this.userId;
    if (!canEdit) {
      alert('You don’t have permission to edit this user.');
      return;
    }

    const newName = prompt('Edit name:', userRecord.name);
    if (!newName) return;

    const { error } = await supabase
      .from('users')
      .update({ name: newName })
      .eq('id', userRecord.id);

    if (error) {
      console.error('❌ Error updating user:', error);
    } else {
      console.log('✅ User updated:', userRecord.id);
      await this.loadUsers();
    }
  }

  // ===== Change Role (Admin Only) =====
  async changeRole(userRecord: any, newRole: 'admin' | 'member') {
    if (!this.isAdmin) {
      alert('Only admins can change roles.');
      return;
    }

    if (userRecord.id === this.userId) {
      alert('You cannot change your own role.');
      return;
    }

    if (userRecord.role === newRole) return;

    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userRecord.id);

    if (error) {
      console.error('❌ Error changing role:', error);
    } else {
      console.log(`✅ Changed ${userRecord.name}'s role to ${newRole}`);
      await this.loadUsers();
    }
  }

  // ===== Approve Pending User =====
  async approveUser(userRecord: any) {
    if (!this.isAdmin) {
      alert('Only admins can approve members.');
      return;
    }

    const { error } = await supabase
      .from('users')
      .update({ role: 'member' })
      .eq('id', userRecord.id);

    if (error) {
      console.error('❌ Error approving user:', error);
    } else {
      console.log(`✅ Approved ${userRecord.name}`);
      await this.loadUsers();
    }
  }

  // ===== Reject (Delete) Pending User =====
  async rejectUser(id: string) {
    if (!this.isAdmin) {
      alert('Only admins can reject members.');
      return;
    }

    if (!confirm('Are you sure you want to reject this user?')) return;

    const { error } = await supabase.from('users').delete().eq('id', id);

    if (error) {
      console.error('❌ Error rejecting user:', error);
    } else {
      console.log('✅ Rejected user:', id);
      await this.loadUsers();
    }
  }

  // ===== Delete User (Admin Only) =====
  async deleteUser(id: string) {
    if (!this.isAdmin) {
      alert('Only admins can delete users.');
      return;
    }

    if (id === this.userId) {
      alert('You cannot delete yourself.');
      return;
    }

    if (!confirm('Are you sure you want to remove this user?')) return;

    const { error } = await supabase.from('users').delete().eq('id', id);

    if (error) {
      console.error('❌ Error deleting user:', error);
    } else {
      console.log('✅ User deleted:', id);
      await this.loadUsers();
    }
  }
}
