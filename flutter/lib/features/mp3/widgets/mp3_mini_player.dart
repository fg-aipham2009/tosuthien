import 'package:flutter/material.dart';

import '../audio/mp3_audio_controller.dart';
import '../audio/mp3_audio_scope.dart';
import 'mp3_full_player_sheet.dart';
import 'mp3_playback_status.dart';

class Mp3MiniPlayer extends StatelessWidget {
  const Mp3MiniPlayer({super.key});

  @override
  Widget build(BuildContext context) {
    final audio = Mp3AudioScope.of(context);
    final track = audio.currentTrack;
    if (track == null) return const SizedBox.shrink();

    final colors = Theme.of(context).colorScheme;
    final progress = _progress(audio);
    final phase = Mp3PlaybackPhaseX.resolve(
      isActive: true,
      isPlaying: audio.isPlaying,
    );

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
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Mp3PlaybackArtwork(
                      phase: phase,
                      size: 44,
                      borderRadius: 10,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Mp3PlaybackTitleBlock(
                        title: track.title,
                        phase: phase,
                        metaParts: [
                          if (track.categoryName != null) track.categoryName!,
                          if (track.year > 0) '${track.year}',
                        ],
                      ),
                    ),
                    Mp3PlaybackActionButton(
                      phase: phase,
                      onPressed: audio.togglePlayPause,
                      compact: true,
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
