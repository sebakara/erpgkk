import {
  Controller, Get, Post, Delete, Param, UseGuards,
  UploadedFile, UseInterceptors, BadRequestException, Logger,
  StreamableFile, Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuid } from 'uuid';
import { createReadStream } from 'fs';
import { FilesService } from './files.service';
import { getUploadsDir } from '../common/uploads';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';

@Controller('projects/:projectId/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(private filesService: FilesService) {}

  @Get()
  list(@Param('projectId') projectId: string) {
    return this.filesService.findByProject(projectId);
  }

  @Get(':fileId')
  @Header('Cache-Control', 'private, max-age=60')
  async download(
    @Param('projectId') projectId: string,
    @Param('fileId') fileId: string,
  ) {
    const { file, path } = await this.filesService.getStoredPath(fileId, projectId);
    const safeName = String(file.original_name || 'file').replace(/[\r\n"]/g, '_');
    return new StreamableFile(createReadStream(path), {
      type: file.mime_type || 'application/octet-stream',
      disposition: `inline; filename="${safeName}"`,
    });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.Admin, Role.Manager, Role.Employee)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, getUploadsDir()),
      filename: (_req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `proj-${uuid()}-${safeName}`);
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async upload(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('No file received — check the field name is "file"');
    this.logger.log(`Upload: ${file.originalname} (${file.size}b) → ${file.path}`);
    return this.filesService.create(projectId, user.id, file);
  }

  @Delete(':fileId')
  async remove(
    @Param('projectId') projectId: string,
    @Param('fileId') fileId: string,
  ) {
    await this.filesService.remove(fileId, projectId);
    return { deleted: true };
  }
}