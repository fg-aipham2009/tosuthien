import 'package:flutter/material.dart';

import '../../mp3/models/mp3_track.dart';
import '../../mp3_favorites/state/mp3_favorites_scope.dart';
import '../../offline_mp3/state/offline_mp3_library.dart';
import '../../offline_mp3/state/offline_mp3_scope.dart';
import '../utils/mp3_format.dart';
import 'mp3_playback_status.dart';

class Mp3TrackTile extends StatelessWidget {
  const Mp3TrackTile({
    super.key,
    required this.track,
    this.onTap,
    this.isActive = false,
    this.isPlaying = false,
    this.showYear = true,
    this.showDivider = false,
    this.showLibraryActions = true,
  });

  final Mp3Track track;
  final VoidCallback? onTap;
  final bool isActive;
  final bool isPlaying;
  final bool showYear;
  final bool showDivider;
  final bool showLibraryActions;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final favorites = Mp3FavoritesScope.maybeOf(context);
    final offline = OfflineMp3Scope.maybeOf(context);
    final favorite = favorites?.isFavorite(track.id) ?? false;
    final downloaded = offline?.isDownloaded(track.id) ?? false;
    final downloading = offline?.isDownloading(track.id) ?? false;

    final phase = Mp3PlaybackPhaseX.resolve(
      isActive: isActive,
      isPlaying: isPlaying,
    );

    final metaParts = [
      if (!showYear && track.location != null) track.location!,
      if (showYear && track.year > 0) '${track.year}',
      if (track.categoryName != null) track.categoryName!,
      if (track.duration != null) formatDuration(track.duration),
      if (downloaded) 'Đã tải',
    ];

    return Column(
      children: [
        Material(
          color: phase.isActive
              ? colors.primaryContainer.withValues(alpha: 0.35)
              : Colors.transparent,
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Mp3PlaybackArtwork(phase: phase, size: 48, borderRadius: 14),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Mp3PlaybackTitleBlock(
                      title: track.title,
                      phase: phase,
                      metaParts: metaParts,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      if (showLibraryActions) ...[
                        if (favorites != null)
                          _TrackActionIcon(
                            tooltip: favorite ? 'Bỏ yêu thích' : 'Yêu thích',
                            onPressed: () => favorites.toggle(track),
                            icon: favorite
                                ? Icons.favorite
                                : Icons.favorite_border,
                            color: favorite
                                ? colors.error
                                : colors.onSurfaceVariant,
                          ),
                        if (offline != null)
                          downloading
                              ? const SizedBox(
                                  width: 40,
                                  height: 40,
                                  child: Center(
                                    child: SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    ),
                                  ),
                                )
                              : _TrackActionIcon(
                                  tooltip: downloaded
                                      ? 'Xóa bản offline'
                                      : 'Tải về',
                                  onPressed: () =>
                                      _onDownloadPressed(context, offline),
                                  icon: downloaded
                                      ? Icons.download_done_rounded
                                      : Icons.download_rounded,
                                  color: downloaded
                                      ? colors.primary
                                      : colors.onSurfaceVariant,
                                ),
                      ],
                      Mp3PlaybackActionButton(
                        phase: phase,
                        onPressed: onTap,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
        if (showDivider)
          Divider(
            height: 1,
            indent: 76,
            endIndent: 16,
            color: colors.outlineVariant.withValues(alpha: 0.5),
          ),
      ],
    );
  }

  Future<void> _onDownloadPressed(
    BuildContext context,
    OfflineMp3Library offline,
  ) async {
    final messenger = ScaffoldMessenger.of(context);
    if (offline.isDownloaded(track.id)) {
      await offline.removeDownload(track.id);
      messenger.showSnackBar(
        const SnackBar(content: Text('Đã xóa bản tải về')),
      );
      return;
    }
    try {
      await offline.download(track);
      if (!context.mounted) return;
      messenger.showSnackBar(
        const SnackBar(content: Text('Đã tải về — nghe được khi offline')),
      );
    } catch (e) {
      if (!context.mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text('Tải thất bại: $e')),
      );
    }
  }
}

/// Equal-sized trailing control so favorite / download / play stay aligned.
class _TrackActionIcon extends StatelessWidget {
  const _TrackActionIcon({
    required this.tooltip,
    required this.onPressed,
    required this.icon,
    required this.color,
  });

  final String tooltip;
  final VoidCallback onPressed;
  final IconData icon;
  final Color color;

  static const double _box = 40;
  static const double _iconSize = 22;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _box,
      height: _box,
      child: IconButton(
        tooltip: tooltip,
        onPressed: onPressed,
        padding: EdgeInsets.zero,
        visualDensity: VisualDensity.compact,
        constraints: const BoxConstraints.tightFor(width: _box, height: _box),
        icon: Icon(icon, size: _iconSize, color: color),
      ),
    );
  }
}
