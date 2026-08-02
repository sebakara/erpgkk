import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('hr/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('employee')
  employee(
    @CurrentUser() user: any,
    @Query('userId') userId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    return this.reportsService.employeeReport(user.company_id, userId, dateFrom, dateTo);
  }

  @Get('department')
  department(
    @CurrentUser() user: any,
    @Query('departmentId') departmentId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    return this.reportsService.departmentReport(user.company_id, departmentId, dateFrom, dateTo);
  }
}
