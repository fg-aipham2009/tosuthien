import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

export type AdminPublic = {
  id: string;
  username: string;
  displayName: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureBootstrapAdmin();
  }

  private async ensureBootstrapAdmin() {
    const count = await this.prisma.adminUser.count();
    if (count > 0) return;

    const username =
      this.config.get<string>('ADMIN_BOOTSTRAP_USERNAME')?.trim() || 'admin';
    const password =
      this.config.get<string>('ADMIN_BOOTSTRAP_PASSWORD')?.trim() ||
      'Tosuthien@Admin2026';
    const displayName =
      this.config.get<string>('ADMIN_BOOTSTRAP_NAME')?.trim() || 'Quản trị';

    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.adminUser.create({
      data: { username, passwordHash, displayName, isActive: true },
    });
    console.log(
      `[auth] Seeded bootstrap admin user "${username}" (change password after login)`,
    );
  }

  private toPublic(row: {
    id: string;
    username: string;
    displayName: string | null;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
  }): AdminPublic {
    return {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      isActive: row.isActive,
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
    };
  }

  async login(username: string, password: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { username: username.trim() },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');
    }

    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const secret =
      this.config.get<string>('JWT_SECRET') || 'tosuthien-dev-jwt-secret';
    const expiresIn = (this.config.get<string>('JWT_EXPIRES_IN') ||
      '7d') as `${number}d`;
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, username: user.username },
      { secret, expiresIn },
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: this.toPublic(user),
    };
  }

  async me(userId: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản không còn hiệu lực');
    }
    return this.toPublic(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Mật khẩu mới tối thiểu 8 ký tự');
    }
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Mật khẩu hiện tại không đúng');

    await this.prisma.adminUser.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    return { updated: true };
  }

  async listUsers() {
    const rows = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  async createUser(input: {
    username: string;
    password: string;
    displayName?: string;
    isActive?: boolean;
  }) {
    const username = input.username.trim();
    if (!username) throw new BadRequestException('Thiếu username');
    if (!input.password || input.password.length < 8) {
      throw new BadRequestException('Mật khẩu tối thiểu 8 ký tự');
    }
    const exists = await this.prisma.adminUser.findUnique({ where: { username } });
    if (exists) throw new ConflictException('Username đã tồn tại');

    const row = await this.prisma.adminUser.create({
      data: {
        username,
        passwordHash: await bcrypt.hash(input.password, 10),
        displayName: input.displayName?.trim() || null,
        isActive: input.isActive ?? true,
      },
    });
    return this.toPublic(row);
  }

  async updateUser(
    id: string,
    input: {
      displayName?: string | null;
      isActive?: boolean;
      password?: string;
    },
  ) {
    const existing = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy tài khoản');

    if (input.password !== undefined) {
      if (input.password.length < 8) {
        throw new BadRequestException('Mật khẩu tối thiểu 8 ký tự');
      }
    }

    const row = await this.prisma.adminUser.update({
      where: { id },
      data: {
        ...(input.displayName !== undefined
          ? { displayName: input.displayName?.trim() || null }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.password
          ? { passwordHash: await bcrypt.hash(input.password, 10) }
          : {}),
      },
    });
    return this.toPublic(row);
  }

  async removeUser(id: string) {
    const count = await this.prisma.adminUser.count();
    if (count <= 1) {
      throw new BadRequestException('Không thể xóa admin cuối cùng');
    }
    const existing = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy tài khoản');
    await this.prisma.adminUser.delete({ where: { id } });
    return { deleted: true };
  }
}
