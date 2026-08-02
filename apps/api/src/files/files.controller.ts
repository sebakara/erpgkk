import {
  Controller, Get, Post, Delete, Param, UseGuards,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuid } from 'uuid';
import { unlink } from 'fs/promises';
import { ConfigService } from '@nestjs/config';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('projects/:projectId/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(
    private filesService: FilesService,
    private config: ConfigService,
  ) {}

  @Get()
  list(@Param('projectId') projectId: string) {
    return this.filesService.findByProject(projectId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads'),
      filename: (_req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `proj-${uuid()}-${safeName}`);
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  }))
  async upload(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    const apiUrl = this.config.get('API_URL', 'http://localhost:3001');
    return this.filesService.create(projectId, user.id, file, apiUrl);
  }

  @Delete(':fileId')
  async remove(
    @Param('projectId') projectId: string,
    @Param('fileId') fileId: string,
  ) {
    const result = await this.filesService.remove(fileId, projectId);
    try {
      await unlink(join(process.cwd(), 'uploads', result.stored_name));
    } catch { /* file already gone */ }
    return { deleted: true };
  }
}
