import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { MEDIA_DIRS } from '../common/media-paths';
import { PublicUrlService } from '../common/public-url.service';

const ROOTS = new Set(Object.values(MEDIA_DIRS));

export interface FileEntry {
  name: string;
  path: string;
  size: number;
  url: string;
  modifiedAt: string;
}

export interface FolderListing {
  root: string;
  currentPath: string;
  folders: string[];
  files: FileEntry[];
}

@Injectable()
export class FilesService {
  private readonly dataRoot: string;

  constructor(
    private readonly config: ConfigService,
    private readonly urls: PublicUrlService,
  ) {
    this.dataRoot = path.resolve(
      this.config.get<string>('DATA_ROOT') || path.join(process.cwd(), '..', 'data'),
    );
  }

  listRoots(): string[] {
    return [...ROOTS];
  }

  listFolder(root: string, subPath = ''): FolderListing {
    const abs = this.resolveDir(root, subPath);
    if (!fs.existsSync(abs)) {
      throw new NotFoundException('Thư mục không tồn tại');
    }

    const entries = fs.readdirSync(abs, { withFileTypes: true });
    const normalized = this.normalizeSubPath(subPath);
    const folders: string[] = [];
    const files: FileEntry[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const rel = normalized ? `${normalized}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        folders.push(rel.endsWith('/') ? rel : `${rel}/`);
      } else if (entry.isFile()) {
        const stat = fs.statSync(path.join(abs, entry.name));
        const storagePath = path.join(root, rel).replace(/\\/g, '/');
        files.push({
          name: entry.name,
          path: storagePath,
          size: stat.size,
          url: this.urls.file(storagePath),
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    }

    folders.sort();
    files.sort((a, b) => a.name.localeCompare(b.name));

    return {
      root,
      currentPath: normalized ? `${normalized}/` : '',
      folders,
      files,
    };
  }

  createFolder(root: string, folderPath: string): FolderListing {
    const normalized = this.normalizeSubPath(folderPath);
    if (!normalized) {
      throw new BadRequestException('Tên thư mục không hợp lệ');
    }
    const abs = this.resolveDir(root, normalized);
    fs.mkdirSync(abs, { recursive: true });
    const parent = path.dirname(normalized.replace(/\\/g, '/'));
    return this.listFolder(root, parent === '.' ? '' : parent);
  }

  deleteFile(root: string, filePath: string): { deleted: string } {
    const abs = this.resolveFile(root, filePath);
    if (!fs.existsSync(abs)) {
      throw new NotFoundException('File không tồn tại');
    }
    fs.unlinkSync(abs);
    return { deleted: filePath.replace(/\\/g, '/') };
  }

  private resolveDir(root: string, subPath: string): string {
    this.assertRoot(root);
    const base = path.join(this.dataRoot, root);
    const normalized = this.normalizeSubPath(subPath);
    const abs = normalized ? path.join(base, normalized) : base;
    this.assertInside(base, abs);
    return abs;
  }

  private resolveFile(root: string, filePath: string): string {
    this.assertRoot(root);
    const clean = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
    if (!clean || clean.includes('..')) {
      throw new BadRequestException('Đường dẫn file không hợp lệ');
    }
    const base = path.join(this.dataRoot, root);
    const abs = path.join(this.dataRoot, clean);
    this.assertInside(base, abs);
    if (!abs.startsWith(path.join(this.dataRoot, root))) {
      throw new BadRequestException('Đường dẫn file không hợp lệ');
    }
    return abs;
  }

  private assertRoot(root: string) {
    if (!ROOTS.has(root as (typeof MEDIA_DIRS)[keyof typeof MEDIA_DIRS])) {
      throw new BadRequestException(`Root không hợp lệ: ${root}`);
    }
  }

  private assertInside(base: string, target: string) {
    const rel = path.relative(base, target);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new BadRequestException('Đường dẫn nằm ngoài thư mục cho phép');
    }
  }

  private normalizeSubPath(subPath: string): string {
    const clean = subPath.replace(/^\/+|\/+$/g, '').replace(/\\/g, '/');
    if (clean.includes('..')) {
      throw new BadRequestException('Đường dẫn không hợp lệ');
    }
    return clean;
  }
}
