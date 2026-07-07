import 'package:flutter/material.dart';

import '../../../app/theme.dart';
import '../models/mp3_track.dart';
import '../utils/mp3_format.dart';

class Mp3TrackTile extends StatelessWidget {
  const Mp3TrackTile({
    super.key,
    required this.track,
    this.onTap,
    this.isPlaying = false,
    this.showYear = true,
    this.showDivider = false,
  });

  final Mp3Track track;
  final VoidCallback? onTap;
  final bool isPlaying;
  final bool showYear;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final meta = [
      if (!showYear && track.location != null) track.location,
      if (showYear) '${track.year}',
      if (track.categoryName != null) track.categoryName,
    ].whereType<String>().join(' · ');

    return Column(
      children: [
        Material(
          color: isPlaying
              ? colors.primaryContainer.withValues(alpha: 0.35)
              : Colors.transparent,
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      gradient: isPlaying
                          ? AppTheme.mp3HeaderGradient
                          : AppTheme.mp3AccentGradient,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      isPlaying ? Icons.graphic_eq_rounded : Icons.music_note_rounded,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          track.title,
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontWeight: isPlaying ? FontWeight.w700 : FontWeight.w600,
                                color: isPlaying ? colors.primary : colors.onSurface,
                                height: 1.4,
                              ),
                        ),
                        if (meta.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            meta,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: colors.onSurfaceVariant,
                                  height: 1.35,
                                ),
                          ),
                        ],
                        if (track.duration != null) ...[
                          const SizedBox(height: 6),
                          Text(
                            formatDuration(track.duration),
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  color: colors.outline,
                                ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: onTap,
                    icon: Icon(
                      isPlaying ? Icons.pause_circle_filled : Icons.play_circle_fill,
                      size: 36,
                      color: isPlaying ? colors.primary : colors.primary.withValues(alpha: 0.75),
                    ),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
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
}
