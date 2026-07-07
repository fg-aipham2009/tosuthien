import 'package:flutter/material.dart';

import '../../../app/theme.dart';
import '../audio/mp3_audio_controller.dart';
import '../audio/mp3_audio_scope.dart';
import '../utils/mp3_format.dart';
import 'mp3_full_player_sheet.dart';

class Mp3MiniPlayer extends StatelessWidget {
  const Mp3MiniPlayer({super.key});

  @override
  Widget build(BuildContext context) {
    final audio = Mp3AudioScope.of(context);
    final track = audio.currentTrack;
    if (track == null) return const SizedBox.shrink();

    final colors = Theme.of(context).colorScheme;
    final progress = _progress(audio);

    return Material(
      elevation: 8,
      color: colors.surfaceContainerHighest,
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            LinearProgressIndicator(
              value: progress,
              minHeight: 2,
              backgroundColor: colors.surfaceContainerHigh,
              color: colors.primary,
            ),
            InkWell(
              onTap: () => showMp3FullPlayerSheet(context),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        gradient: AppTheme.mp3AccentGradient,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.graphic_eq, color: Colors.white),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            track.title,
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w600,
                                  height: 1.35,
                                ),
                          ),
                          Text(
                            [
                              if (track.categoryName != null) track.categoryName,
                              '${track.year}',
                            ].whereType<String>().join(' · '),
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: colors.onSurfaceVariant,
                                  height: 1.35,
                                ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: audio.togglePlayPause,
                      icon: Icon(audio.isPlaying ? Icons.pause : Icons.play_arrow),
                      style: IconButton.styleFrom(
                        backgroundColor: colors.primaryContainer,
                        foregroundColor: colors.onPrimaryContainer,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  double? _progress(Mp3AudioController audio) {
    final total = audio.duration?.inMilliseconds;
    if (total == null || total <= 0) return null;
    return (audio.position.inMilliseconds / total).clamp(0.0, 1.0);
  }
}

void showMp3FullPlayerSheet(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => const Mp3FullPlayerSheet(),
  );
}
