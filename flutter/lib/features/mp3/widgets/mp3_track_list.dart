import 'package:flutter/material.dart';

import '../../../../core/widgets/empty_state_view.dart';
import '../models/mp3_track.dart';
import 'mp3_track_tile.dart';

class Mp3TrackList extends StatelessWidget {
  const Mp3TrackList({
    super.key,
    required this.tracks,
    this.onTrackTap,
    this.groupByYear = false,
    this.playingTrackId,
    this.shrinkWrap = false,
  });

  final List<Mp3Track> tracks;
  final ValueChanged<Mp3Track>? onTrackTap;
  final bool groupByYear;
  final String? playingTrackId;
  final bool shrinkWrap;

  @override
  Widget build(BuildContext context) {
    if (tracks.isEmpty) {
      return const EmptyStateView(
        icon: Icons.music_off,
        message: 'Chưa có bài MP3',
      );
    }

    final scrollPhysics = shrinkWrap
        ? const NeverScrollableScrollPhysics()
        : const AlwaysScrollableScrollPhysics();

    if (!groupByYear) {
      return ListView.builder(
        physics: scrollPhysics,
        shrinkWrap: shrinkWrap,
        padding: EdgeInsets.zero,
        itemCount: tracks.length,
        itemBuilder: (context, index) {
          final track = tracks[index];
          return Mp3TrackTile(
            track: track,
            isPlaying: playingTrackId == track.id,
            showDivider: index < tracks.length - 1,
            onTap: onTrackTap == null ? null : () => onTrackTap!(track),
          );
        },
      );
    }

    final byYear = <int, List<Mp3Track>>{};
    for (final track in tracks) {
      byYear.putIfAbsent(track.year, () => []).add(track);
    }
    final years = byYear.keys.toList()..sort((a, b) => b.compareTo(a));

    return ListView.builder(
      physics: scrollPhysics,
      shrinkWrap: shrinkWrap,
      padding: EdgeInsets.zero,
      itemCount: years.fold<int>(0, (sum, y) => sum + 1 + byYear[y]!.length),
      itemBuilder: (context, index) {
        var cursor = 0;
        for (final year in years) {
          if (index == cursor) {
            return _YearHeader(year: year, count: byYear[year]!.length);
          }
          cursor += 1;
          final sectionTracks = byYear[year]!;
          final localIndex = index - cursor;
          if (localIndex < sectionTracks.length) {
            final track = sectionTracks[localIndex];
            return Mp3TrackTile(
              track: track,
              isPlaying: playingTrackId == track.id,
              showYear: false,
              showDivider: localIndex < sectionTracks.length - 1,
              onTap: onTrackTap == null ? null : () => onTrackTap!(track),
            );
          }
          cursor += sectionTracks.length;
        }
        return const SizedBox.shrink();
      },
    );
  }
}

class _YearHeader extends StatelessWidget {
  const _YearHeader({required this.year, required this.count});

  final int year;
  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 18,
            decoration: BoxDecoration(
              color: colors.primary,
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          const SizedBox(width: 10),
          Text(
            '$year',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: colors.primary,
                ),
          ),
          const SizedBox(width: 8),
          Text(
            '$count bài',
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: colors.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );
  }
}
