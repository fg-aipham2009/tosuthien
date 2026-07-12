import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../app/theme.dart';
import '../audio/mp3_audio_controller.dart';
import '../audio/mp3_audio_scope.dart';
import '../presentation/mp3_player_screen.dart';
import 'mp3_playback_status.dart';

/// Persistent Now Playing bar (Spotify / Zing style) above the tab bar.
class Mp3MiniPlayer extends StatelessWidget {
  const Mp3MiniPlayer({super.key});

  @override
  Widget build(BuildContext context) {
    final audio = Mp3AudioScope.of(context);
    final track = audio.currentTrack;
    if (track == null) return const SizedBox.shrink();

    final progress = _progress(audio);
    final phase = Mp3PlaybackPhaseX.resolve(
      isActive: true,
      isPlaying: audio.isPlaying,
    );
    final meta = [
      if (track.categoryName != null) track.categoryName!,
      if (track.year > 0) '${track.year}',
    ].join(' · ');

    return Material(
      color: Colors.transparent,
      child: SafeArea(
        top: false,
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 0, 8, 6),
          child: Material(
            color: AppTheme.playerSurface,
            borderRadius: BorderRadius.circular(8),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => openMp3PlayerScreen(context),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    height: 56,
                    child: Row(
                      children: [
                        const SizedBox(width: 8),
                        Mp3PlaybackArtwork(
                          phase: phase,
                          size: 40,
                          borderRadius: 4,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                track.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  height: 1.2,
                                ),
                              ),
                              if (meta.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(
                                  meta,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: AppTheme.playerTextSecondary,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w400,
                                    height: 1.2,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        IconButton(
                          tooltip: phase.isPlaying ? 'Tạm dừng' : 'Phát',
                          onPressed: () {
                            HapticFeedback.selectionClick();
                            audio.togglePlayPause();
                          },
                          icon: Icon(
                            phase.isPlaying
                                ? Icons.pause_rounded
                                : Icons.play_arrow_rounded,
                            color: Colors.white,
                            size: 28,
                          ),
                        ),
                        IconButton(
                          tooltip: 'Bài tiếp',
                          onPressed: audio.hasNext ? audio.next : null,
                          icon: Icon(
                            Icons.skip_next_rounded,
                            color: audio.hasNext
                                ? Colors.white
                                : AppTheme.playerTextTertiary,
                            size: 28,
                          ),
                        ),
                        const SizedBox(width: 2),
                      ],
                    ),
                  ),
                  LinearProgressIndicator(
                    value: progress,
                    minHeight: 2,
                    backgroundColor: Colors.transparent,
                    color: AppTheme.playerAccent,
                  ),
                ],
              ),
            ),
          ),
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
