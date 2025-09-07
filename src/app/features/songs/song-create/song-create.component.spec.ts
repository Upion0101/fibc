import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SongCreateComponent } from './song-create.component';

describe('SongCreateComponent', () => {
  let component: SongCreateComponent;
  let fixture: ComponentFixture<SongCreateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SongCreateComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SongCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
