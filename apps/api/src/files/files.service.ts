import { Injectable, Inject, NotFoundException, Optional } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { v4 as uuid } from 'uuid';

@Injectable()
export class FilesService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    @Optional() private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async findByProject(projectId: string) {
    return this.knex('project_files as f')
      .where('f.project_id', projectId)
      .whereNull('f.deleted_at')
      .leftJoin('users as u', 'f.uploaded_by', 'u.id')
      .select(
        'f.*',
        this.knex.raw("CONCAT(u.first_name, ' ', u.last_name) as uploader_name"),
        'u.avatar_url as uploader_avatar',
      )
      .orderBy('f.created_at', 'desc');
  }

  async create(projectId: string, uploadedBy: string, file: Express.Multer.File, apiUrl: string) {
    const id = uuid();
    const url = `${apiUrl}/uploads/${file.filename}`;
    await this.knex('project_files').insert({
      id,
      project_id: projectId,
      original_name: file.originalname,
      stored_name: file.filename,
      url,
      size: file.size,
      mime_type: file.mimetype,
      uploaded_by: uploadedBy,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const fileRow = await this.knex('project_files').where('id', id).first();
    const project = await this.knex('projects').where({ id: projectId }).first('name');
    const uploader = await this.knex('users').where({ id: uploadedBy }).select('first_name', 'last_name').first();
    const memberIds = await this.knex('project_members').where({ project_id: projectId }).pluck('user_id');
    await this.notificationsGateway?.notifyUsers(
      memberIds,
      {
        type: 'file_uploaded',
        title: 'New file in project',
        body: `${uploader ? `${uploader.first_name} ${uploader.last_name}` : 'Someone'} uploaded ${file.originalname}${project?.name ? ` to ${project.name}` : ''}`,
        data: { href: `/projects/${projectId}/folder`, project_id: projectId, file_id: id },
      },
      uploadedBy,
    );
    return fileRow;
  }

  async remove(fileId: string, projectId: string) {
    const file = await this.knex('project_files').where({ id: fileId, project_id: projectId }).whereNull('deleted_at').first();
    if (!file) throw new NotFoundException('File not found');
    await this.knex('project_files').where('id', fileId).update({ deleted_at: new Date() });
    return { deleted: true, stored_name: file.stored_name };
  }
}
