import 'package:flutter/material.dart';

import '../../offline_books/state/offline_books_library.dart';
import '../../offline_books/state/offline_books_scope.dart';
import '../models/book_pdf.dart';

class BookTile extends StatelessWidget {
  const BookTile({
    super.key,
    required this.book,
    required this.onTap,
    this.showDownloadAction = true,
  });

  final BookPdf book;
  final VoidCallback onTap;
  final bool showDownloadAction;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final offline = OfflineBooksScope.maybeOf(context);
    final downloaded = offline?.isDownloaded(book.id) ?? false;
    final downloading = offline?.isDownloading(book.id) ?? false;

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: colors.outlineVariant.withValues(alpha: 0.45)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  width: 52,
                  height: 68,
                  child: book.coverImageUrl != null && book.coverImageUrl!.isNotEmpty
                      ? Image.network(
                          book.coverImageUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => _CoverFallback(colors: colors),
                        )
                      : _CoverFallback(colors: colors),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      book.displayTitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                            height: 1.3,
                          ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      [
                        book.author,
                        if (downloaded) 'Đã tải',
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: colors.onSurfaceVariant,
                          ),
                    ),
                    if (book.lastPage != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Đọc dở · tr.${book.lastPage}',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: colors.primary,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                  ],
                ),
              ),
              if (showDownloadAction && offline != null)
                downloading
                    ? const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : IconButton(
                        tooltip: downloaded ? 'Xóa bản offline' : 'Tải về',
                        onPressed: () => _onDownload(context, offline),
                        icon: Icon(
                          downloaded
                              ? Icons.download_done_rounded
                              : Icons.download_rounded,
                          color: downloaded
                              ? colors.primary
                              : colors.onSurfaceVariant,
                        ),
                      ),
              Icon(Icons.chevron_right_rounded, color: colors.outline),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _onDownload(
    BuildContext context,
    OfflineBooksLibrary offline,
  ) async {
    final messenger = ScaffoldMessenger.of(context);
    if (offline.isDownloaded(book.id)) {
      await offline.removeDownload(book.id);
      messenger.showSnackBar(
        const SnackBar(content: Text('Đã xóa sách tải về')),
      );
      return;
    }
    try {
      await offline.download(book);
      if (!context.mounted) return;
      messenger.showSnackBar(
        const SnackBar(content: Text('Đã tải sách — đọc được khi offline')),
      );
    } catch (e) {
      if (!context.mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text('Tải thất bại: $e')),
      );
    }
  }
}

class _CoverFallback extends StatelessWidget {
  const _CoverFallback({required this.colors});

  final ColorScheme colors;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            colors.primaryContainer,
            colors.primary.withValues(alpha: 0.85),
          ],
        ),
      ),
      child: Icon(Icons.menu_book_rounded, color: colors.onPrimaryContainer),
    );
  }
}
