import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { DepartmentsModule } from './departments/departments.module';
import { ProjectsModule } from './projects/projects.module';
import { SprintsModule } from './sprints/sprints.module';
import { IssuesModule } from './issues/issues.module';
import { HrModule } from './hr/hr.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DocsModule } from './docs/docs.module';
import { ChatModule } from './chat/chat.module';
import { FilesModule } from './files/files.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    DepartmentsModule,
    ProjectsModule,
    SprintsModule,
    IssuesModule,
    DocsModule,
    HrModule,
    NotificationsModule,
    ChatModule,
    FilesModule,
  ],
})
export class AppModule {}
