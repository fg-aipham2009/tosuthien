import 'package:flutter/material.dart';

import '../../../app/theme.dart';
import '../audio/mp3_audio_scope.dart';
import '../utils/mp3_format.dart';
import 'mp3_playback_status.dart';

class Mp3FullPlayerSheet extends StatelessWidget {
  const Mp3FullPlayerSheet({super.key});

  @override
  Widget build(BuildContext context) {
    final audio = Mp3AudioScope.of(context);

    return ListenableBuilder(
      listenable: audio,
      builder: (context, _) {
        final track = audio.currentTrack;
        if (track == null) return const SizedBox.shrink();

        final colors = Theme.of(context).colorScheme;
        final total = audio.duration ?? Duration.zero;
        final position = audio.position;
        final maxMs =
            total.inMilliseconds > 0 ? total.inMilliseconds.toDouble() : 1.0;
        final phase = Mp3PlaybackPhaseX.resolve(
          isActive: true,
          isPlaying: audio.isPlaying,
        );

        return DraggableScrollableSheet(
          initialChildSize: 0.88,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          builder: (context, scrollController) {
            return Container(
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: colors.outlineVariant,
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  AspectRatio(
                    aspectRatio: 1,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: AppTheme.mp3HeaderGradient,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: colors.primary.withValues(alpha: 0.25),
                            blurRadius: 24,
                            offset: const Offset(0, 12),
                          ),
                        ],
                      ),
                      child: Icon(
                        phase.artworkIcon,
                        size: 96,
                        color: Colors.white70,
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),
                  Text(
                    track.title,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          height: 1.35,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    [
                      if (track.categoryName != null) track.categoryName,
                      if (track.year > 0) '${track.year}',
                      if (track.location != null) track.location,
                      if (phase.statusLabel != null) phase.statusLabel,
                    ].whereType<String>().join(' · '),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: colors.onSurfaceVariant,
                          height: 1.35,
                        ),
                  ),
                  const SizedBox(height: 28),
                  Slider(
                    value: position.inMilliseconds
                        .clamp(0, maxMs.toInt())
                        .toDouble(),
                    max: maxMs,
                    onChanged: (value) =>
                        audio.seek(Duration(milliseconds: value.round())),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          formatDuration(position),
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                        Text(
                          formatDuration(total),
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        onPressed: audio.hasPrevious ? audio.previous : null,
                        iconSize: 32,
                        icon: const Icon(Icons.skip_previous_rounded),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: audio.togglePlayPause,
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.all(20),
                          shape: const CircleBorder(),
                        ),
                        child: Icon(
                          phase.compactActionIcon,
                          size: 36,
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        onPressed: audio.hasNext ? audio.next : null,
                        iconSize: 32,
                        icon: const Icon(Icons.skip_next_rounded),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
