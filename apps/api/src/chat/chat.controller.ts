import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('conversations')
  getConversations(@CurrentUser() user: any) {
    return this.chatService.getMyConversations(user.id, user.company_id);
  }

  @Post('conversations/direct')
  startDirect(@CurrentUser() user: any, @Body('userId') otherId: string) {
    return this.chatService.getOrCreateDirect(user.id, otherId, user.company_id);
  }

  @Post('conversations/department')
  startDepartment(@CurrentUser() user: any, @Body('departmentId') deptId: string) {
    return this.chatService.getOrCreateDepartment(deptId, user.company_id);
  }

  @Get('conversations/:id/messages')
  getMessages(@Param('id') id: string, @CurrentUser() user: any) {
    return this.chatService.getMessages(id, user.id, user.department_id, user.role);
  }

  @Post('conversations/:id/messages')
  sendMessage(@Param('id') id: string, @CurrentUser() user: any, @Body('content') content: string) {
    return this.chatService.sendMessage(id, user.id, content);
  }

  @Post('conversations/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.chatService.markRead(id, user.id);
  }

  @Get('unread')
  getUnread(@CurrentUser() user: any) {
    return this.chatService.getUnreadCount(user.id, user.company_id);
  }

  @Get('users')
  getUsers(@CurrentUser() user: any) {
    return this.chatService.getUsers(user.company_id);
  }

  @Get('departments')
  getDepartments(@CurrentUser() user: any) {
    return this.chatService.getDepartments(user.company_id);
  }
}
