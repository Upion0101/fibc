import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetlistDetailComponent } from './setlist-detail.component';

describe('SetlistDetailComponent', () => {
  let component: SetlistDetailComponent;
  let fixture: ComponentFixture<SetlistDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetlistDetailComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SetlistDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
