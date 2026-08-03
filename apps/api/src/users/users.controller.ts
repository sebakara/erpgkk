import { Controller, Get, Post, Patch, Param, Body, UseGuards, Delete, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuid } from 'uuid';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Public — no auth guard
  @Get('onboarding')
  getInvite(@Query('token') token: string) {
    return this.usersService.getInvite(token);
  }

  @Post('onboarding')
  completeOnboarding(@Body() body: any) {
    const { token, ...data } = body;
    return this.usersService.completeOnboarding(token, data);
  }

  @Post('onboarding/upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads'),
      filename: (_req, file, cb) => cb(null, `${uuid()}${extname(file.originalname)}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  }))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    return { url: `${process.env.API_URL ?? 'http://localhost:3001'}/uploads/${file.filename}` };
  }

  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads'),
      filename: (_req, file, cb) => cb(null, `avatar-${uuid()}${extname(file.originalname)}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'), false);
      cb(null, true);
    },
  }))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    const url = `${process.env.API_URL ?? 'http://localhost:3001'}/uploads/${file.filename}`;
    await this.usersService.update(user.id, { avatar_url: url });
    return { url };
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  listByCompany(@CurrentUser() user: any) {
    return this.usersService.findByCompany(user.company_id, user.id, user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles(Role.Admin, Role.Manager, Role.Hr)
  createEmployee(@CurrentUser() user: any, @Body() body: any) {
    return this.usersService.createEmployee(user.company_id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.usersService.update(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  @Roles(Role.Admin, Role.Hr)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
