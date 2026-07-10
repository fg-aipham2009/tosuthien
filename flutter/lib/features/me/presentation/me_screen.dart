import 'package:flutter/material.dart';

import '../../../app/theme.dart';
import '../../books/models/book_pdf.dart';
import '../../books/presentation/pdf_flip_reader_screen.dart';
import '../../books/widgets/book_tile.dart';
import '../../mp3/audio/mp3_audio_scope.dart';
import '../../mp3/models/mp3_track.dart';
import '../../mp3/widgets/mp3_track_list.dart';
import '../../mp3_favorites/state/mp3_favorites_scope.dart';
import '../../offline_books/models/saved_book_pdf.dart';
import '../../offline_books/state/offline_books_scope.dart';
import '../../offline_mp3/models/saved_mp3_track.dart';
import '../../offline_mp3/state/offline_mp3_scope.dart';

/// Me: favorites (online stream) + offline MP3 + offline books — separate stores.
class MeScreen extends StatelessWidget {
  const MeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final favorites = Mp3FavoritesScope.of(context);
    final offlineMp3 = OfflineMp3Scope.of(context);
    final offlineBooks = OfflineBooksScope.of(context);
    final colors = Theme.of(context).colorScheme;

    return ListenableBuilder(
      listenable: Listenable.merge([favorites, offlineMp3, offlineBooks]),
      builder: (context, _) {
        return ColoredBox(
          color: colors.surfaceContainerLowest,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              const SliverToBoxAdapter(child: _ProfileHeader()),
              SliverToBoxAdapter(
                child: _SectionTitle(
                  icon: Icons.favorite_rounded,
                  title: 'MP3 yêu thích',
                  subtitle: 'Nghe online',
                  count: favorites.items.length,
                ),
              ),
              SliverToBoxAdapter(
                child: _Mp3Section(
                  tracks: favorites.items,
                  emptyIcon: Icons.favorite_border,
                  emptyMessage:
                      'Chưa có bài yêu thích.\nTrong tab MP3, nhấn ♥ để lưu (nghe online).',
                ),
              ),
              SliverToBoxAdapter(
                child: _SectionTitle(
                  icon: Icons.download_done_rounded,
                  title: 'MP3 đã tải',
                  subtitle: 'Offline',
                  count: offlineMp3.downloads.length,
                ),
              ),
              SliverToBoxAdapter(
                child: _Mp3Section(
                  tracks: offlineMp3.downloads,
                  emptyIcon: Icons.download_outlined,
                  emptyMessage: offlineMp3.downloadsSupported
                      ? 'Chưa tải MP3.\nTrong tab MP3, nhấn tải để nghe offline.'
                      : 'Tải MP3 offline dùng trên app iOS/Android.',
                ),
              ),
              SliverToBoxAdapter(
                child: _SectionTitle(
                  icon: Icons.menu_book_rounded,
                  title: 'Sách đã tải',
                  subtitle: 'Offline',
                  count: offlineBooks.downloads.length,
                ),
              ),
              SliverToBoxAdapter(
                child: _BooksSection(
                  books: offlineBooks.downloads,
                  emptyMessage: offlineBooks.downloadsSupported
                      ? 'Chưa tải sách.\nTrong tab Kinh sách, nhấn tải để đọc offline.'
                      : 'Tải sách offline dùng trên app iOS/Android.',
                ),
              ),
              const SliverPadding(padding: EdgeInsets.only(bottom: 32)),
            ],
          ),
        );
      },
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader();

  @override
  Widget build(BuildContext context) {
    final favorites = Mp3FavoritesScope.of(context);
    final offlineMp3 = OfflineMp3Scope.of(context);
    final offlineBooks = OfflineBooksScope.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: AppTheme.mp3HeaderGradient,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 34,
              backgroundColor: Colors.white.withValues(alpha: 0.2),
              child: const Icon(
                Icons.home_rounded,
                size: 40,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Me',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${favorites.items.length} yêu thích · '
                    '${offlineMp3.downloads.length} MP3 · '
                    '${offlineBooks.downloads.length} sách',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.white.withValues(alpha: 0.9),
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Yêu thích: online · Tải về: offline riêng biệt',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: Colors.white.withValues(alpha: 0.75),
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.count,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
      child: Row(
        children: [
          Icon(icon, size: 20, color: colors.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: colors.onSurfaceVariant,
                      ),
                ),
              ],
            ),
          ),
          Text(
            '$count',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: colors.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );
  }
}

class _Mp3Section extends StatelessWidget {
  const _Mp3Section({
    required this.tracks,
    required this.emptyIcon,
    required this.emptyMessage,
  });

  final List<SavedMp3Track> tracks;
  final IconData emptyIcon;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    if (tracks.isEmpty) {
      return _EmptyBox(icon: emptyIcon, message: emptyMessage);
    }

    final playable = tracks.map((t) => t.toTrack()).toList();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: colors.outlineVariant.withValues(alpha: 0.45),
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: ListenableBuilder(
          listenable: Mp3AudioScope.of(context),
          builder: (context, _) {
            final audio = Mp3AudioScope.of(context);
            return Mp3TrackList(
              tracks: playable,
              shrinkWrap: true,
              activeTrackId: audio.currentTrack?.id,
              isPlaying: audio.isPlaying,
              onTrackTap: (track) => _play(context, playable, track),
            );
          },
        ),
      ),
    );
  }

  Future<void> _play(
    BuildContext context,
    List<Mp3Track> queue,
    Mp3Track track,
  ) async {
    final index = queue.indexWhere((t) => t.id == track.id);
    await Mp3AudioScope.of(context).playOrToggle(
      queue,
      startIndex: index < 0 ? 0 : index,
    );
  }
}

class _BooksSection extends StatelessWidget {
  const _BooksSection({
    required this.books,
    required this.emptyMessage,
  });

  final List<SavedBookPdf> books;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    if (books.isEmpty) {
      return _EmptyBox(
        icon: Icons.menu_book_outlined,
        message: emptyMessage,
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          for (final saved in books)
            BookTile(
              book: saved.toBook(),
              onTap: () => _open(context, saved.toBook()),
              showDownloadAction: false,
            ),
        ],
      ),
    );
  }

  void _open(BuildContext context, BookPdf book) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PdfFlipReaderScreen(book: book, initialPage: 1),
      ),
    );
  }
}

class _EmptyBox extends StatelessWidget {
  const _EmptyBox({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: colors.outlineVariant.withValues(alpha: 0.5),
          ),
        ),
        child: Column(
          children: [
            Icon(icon, size: 36, color: colors.outline),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: colors.onSurfaceVariant,
                    height: 1.45,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
