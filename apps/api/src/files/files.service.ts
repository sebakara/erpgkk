import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { v4 as uuid } from 'uuid';

@Injectable()
export class FilesService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async findByProject(projectId: string) {
    return this.knex('project_files as f')
      .where('f.project_id', projectId)
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
    return this.knex('project_files').where('id', id).first();
  }

  async remove(fileId: string, projectId: string) {
    const file = await this.knex('project_files').where({ id: fileId, project_id: projectId }).first();
    if (!file) throw new NotFoundException('File not found');
    await this.knex('project_files').where('id', fileId).delete();
    return { deleted: true, stored_name: file.stored_name };
  }
}
