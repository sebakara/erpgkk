import { Module } from '@nestjs/common';
import { LeaveService } from './leave/leave.service';
import { LeaveController } from './leave/leave.controller';
import { AnnouncementsService } from './announcements/announcements.service';
import { AnnouncementsController } from './announcements/announcements.controller';
import { PerformanceService } from './performance/performance.service';
import { PerformanceController } from './performance/performance.controller';
import { LeavePackagesService } from './leave-packages/leave-packages.service';
import { LeavePackagesController } from './leave-packages/leave-packages.controller';
import { ReportsService } from './reports/reports.service';
import { ReportsController } from './reports/reports.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { DeptNotifierService } from './dept-notifier.service';
import { StandupNotesService } from './standup-notes/standup-notes.service';
import { StandupNotesController } from './standup-notes/standup-notes.controller';

@Module({
  imports: [NotificationsModule],
  providers: [
    DeptNotifierService,
    LeaveService,
    AnnouncementsService,
    PerformanceService,
    LeavePackagesService,
    ReportsService,
    StandupNotesService,
  ],
  controllers: [
    LeaveController,
    AnnouncementsController,
    PerformanceController,
    LeavePackagesController,
    ReportsController,
    StandupNotesController,
  ],
  exports: [LeaveService],
})
export class HrModule {}
