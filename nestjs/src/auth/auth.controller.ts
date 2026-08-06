import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import { AuthService } from './auth.service';

class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  password!: string;
}

class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

class CreateAdminDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateAdminDto {
  @IsOptional()
  @IsString()
  displayName?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

type AuthedRequest = Request & { admin?: { sub: string; username: string } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @Get('me')
  me(@Req() req: AuthedRequest) {
    const id = req.admin?.sub;
    if (!id) throw new UnauthorizedException('Cần đăng nhập admin');
    return this.auth.me(id);
  }

  @Put('me/password')
  changePassword(@Req() req: AuthedRequest, @Body() dto: ChangePasswordDto) {
    const id = req.admin?.sub;
    if (!id) throw new UnauthorizedException('Cần đăng nhập admin');
    return this.auth.changePassword(id, dto.currentPassword, dto.newPassword);
  }

  @Get('users')
  listUsers() {
    return this.auth.listUsers();
  }

  @Post('users')
  createUser(@Body() dto: CreateAdminDto) {
    return this.auth.createUser(dto);
  }

  @Put('users/:id')
  updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminDto,
  ) {
    return this.auth.updateUser(id, dto);
  }

  @Delete('users/:id')
  removeUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.auth.removeUser(id);
  }
}
