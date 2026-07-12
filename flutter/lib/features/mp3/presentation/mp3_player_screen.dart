import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../app/theme.dart';
import '../../mp3_favorites/state/mp3_favorites_scope.dart';
import '../audio/mp3_audio_controller.dart';
import '../audio/mp3_audio_scope.dart';
import '../models/mp3_track.dart';
import '../utils/mp3_format.dart';
import '../widgets/mp3_playback_status.dart';

/// Opens the full-screen player with a Spotify-style slide-up transition.
Future<void> openMp3PlayerScreen(BuildContext context) {
  return Navigator.of(context, rootNavigator: true).push(_mp3PlayerRoute());
}

PageRoute<void> _mp3PlayerRoute() {
  return PageRouteBuilder<void>(
    opaque: true,
    fullscreenDialog: true,
    barrierColor: Colors.black54,
    transitionDuration: const Duration(milliseconds: 320),
    reverseTransitionDuration: const Duration(milliseconds: 280),
    pageBuilder: (context, animation, secondaryAnimation) {
      return const Mp3PlayerScreen();
    },
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final curved = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
        reverseCurve: Curves.easeInCubic,
      );
      return SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 1),
          end: Offset.zero,
        ).animate(curved),
        child: child,
      );
    },
  );
}

/// Tap a list item → open full player immediately, then start playback.
Future<void> playMp3AndOpenPlayer(
  BuildContext context, {
  required List<Mp3Track> queue,
  required Mp3Track track,
}) async {
  final navigator = Navigator.of(context, rootNavigator: true);
  final messenger = ScaffoldMessenger.maybeOf(context);
  final audio = Mp3AudioScope.of(context);
  final index = queue.indexWhere((t) => t.id == track.id);
  final startIndex = index < 0 ? 0 : index;
  final sameTrack = audio.currentTrack?.id == track.id;

  // Set current track first so the player screen has content.
  if (!sameTrack) {
    audio.prepareQueue(queue, startIndex: startIndex);
  }

  // Always open full Now Playing on list tap (do not wait for audio I/O).
  navigator.push(_mp3PlayerRoute());

  try {
    if (sameTrack) {
      if (!audio.isPlaying) await audio.togglePlayPause();
    } else {
      await audio.playPrepared();
    }
  } catch (e) {
    messenger?.showSnackBar(
      SnackBar(content: Text('Không phát được: $e')),
    );
  }
}

/// Full-screen Now Playing — Spotify / Zing layout.
class Mp3PlayerScreen extends StatelessWidget {
  const Mp3PlayerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final audio = Mp3AudioScope.of(context);
    final favorites = Mp3FavoritesScope.maybeOf(context);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: ListenableBuilder(
        listenable: Listenable.merge([
          audio,
          ?favorites,
        ]),
        builder: (context, _) {
          final track = audio.currentTrack;
          final phase = Mp3PlaybackPhaseX.resolve(
            isActive: track != null,
            isPlaying: audio.isPlaying,
          );

          return Scaffold(
            backgroundColor: AppTheme.playerCanvas,
            body: track == null
                ? const Center(
                    child: Text(
                      'Chưa chọn bài hát',
                      style: TextStyle(color: Colors.white70),
                    ),
                  )
                : _NowPlayingBody(
                    audio: audio,
                    track: track,
                    phase: phase,
                  ),
          );
        },
      ),
    );
  }
}

class _NowPlayingBody extends StatelessWidget {
  const _NowPlayingBody({
    required this.audio,
    required this.track,
    required this.phase,
  });

  final Mp3AudioController audio;
  final Mp3Track track;
  final Mp3PlaybackPhase phase;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final artSize = (size.width - 48).clamp(240.0, 340.0);
    final total = audio.duration ?? Duration.zero;
    final position = audio.position;
    final maxMs =
        total.inMilliseconds > 0 ? total.inMilliseconds.toDouble() : 1.0;
    final meta = [
      if (track.categoryName != null) track.categoryName,
      if (track.year > 0) '${track.year}',
    ].whereType<String>().join(' · ');
    final favorites = Mp3FavoritesScope.maybeOf(context);
    final isFavorite = favorites?.isFavorite(track.id) ?? false;
    final contextLabel = track.categoryName ?? 'Đang phát';

    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFF5D4037),
            Color(0xFF2A1F1C),
            AppTheme.playerCanvas,
          ],
          stops: [0.0, 0.45, 1.0],
        ),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 4, 24, 16),
          child: Column(
            children: [
              _TopBar(
                contextLabel: contextLabel,
                onClose: () => Navigator.of(context).pop(),
              ),
              const Spacer(flex: 2),
              _AlbumArt(
                phase: phase,
                size: artSize,
                loading: audio.isLoadingTrack,
              ),
              const Spacer(flex: 2),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          track.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            height: 1.15,
                            letterSpacing: -0.3,
                          ),
                        ),
                        if (meta.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            meta,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppTheme.playerTextSecondary,
                              fontSize: 14,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (favorites != null)
                    IconButton(
                      tooltip: isFavorite ? 'Bỏ yêu thích' : 'Yêu thích',
                      onPressed: () => favorites.toggle(track),
                      icon: Icon(
                        isFavorite ? Icons.favorite : Icons.favorite_border,
                        color: isFavorite
                            ? AppTheme.playerAccent
                            : AppTheme.playerTextSecondary,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 20),
              SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 3,
                  thumbShape:
                      const RoundSliderThumbShape(enabledThumbRadius: 6),
                  overlayShape:
                      const RoundSliderOverlayShape(overlayRadius: 14),
                  activeTrackColor: Colors.white,
                  inactiveTrackColor: AppTheme.playerTextTertiary,
                  thumbColor: Colors.white,
                  overlayColor: Colors.white24,
                ),
                child: Slider(
                  value: position.inMilliseconds
                      .clamp(0, maxMs.toInt())
                      .toDouble(),
                  max: maxMs,
                  onChanged: (v) =>
                      audio.seek(Duration(milliseconds: v.round())),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      formatDuration(position),
                      style: const TextStyle(
                        color: AppTheme.playerTextSecondary,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Text(
                      formatDuration(total),
                      style: const TextStyle(
                        color: AppTheme.playerTextSecondary,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              _TransportControls(audio: audio, phase: phase),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.contextLabel,
    required this.onClose,
  });

  final String contextLabel;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          tooltip: 'Thu nhỏ',
          onPressed: onClose,
          icon: const Icon(
            Icons.keyboard_arrow_down_rounded,
            color: Colors.white,
            size: 32,
          ),
        ),
        Expanded(
          child: Column(
            children: [
              const Text(
                'ĐANG PHÁT TỪ',
                style: TextStyle(
                  color: AppTheme.playerTextSecondary,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.6,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                contextLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 48),
      ],
    );
  }
}

class _AlbumArt extends StatelessWidget {
  const _AlbumArt({
    required this.phase,
    required this.size,
    required this.loading,
  });

  final Mp3PlaybackPhase phase;
  final double size;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            boxShadow: const [
              BoxShadow(
                color: Color(0x80000000),
                blurRadius: 32,
                offset: Offset(0, 12),
              ),
            ],
          ),
          child: Mp3PlaybackArtwork(
            phase: phase,
            size: size,
            borderRadius: 8,
          ),
        ),
        if (loading)
          const SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: Colors.white,
            ),
          ),
      ],
    );
  }
}

class _TransportControls extends StatelessWidget {
  const _TransportControls({
    required this.audio,
    required this.phase,
  });

  final Mp3AudioController audio;
  final Mp3PlaybackPhase phase;

  @override
  Widget build(BuildContext context) {
    final shuffleOn = audio.shuffle;
    final repeat = audio.repeatMode;
    final repeatOn = repeat != Mp3RepeatMode.off;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        IconButton(
          tooltip: 'Ngẫu nhiên',
          onPressed: audio.toggleShuffle,
          icon: Icon(
            Icons.shuffle_rounded,
            color: shuffleOn
                ? AppTheme.playerAccent
                : AppTheme.playerTextSecondary,
          ),
        ),
        IconButton(
          tooltip: 'Bài trước',
          onPressed: audio.hasPrevious ? audio.previous : null,
          iconSize: 40,
          icon: Icon(
            Icons.skip_previous_rounded,
            color: audio.hasPrevious
                ? Colors.white
                : AppTheme.playerTextTertiary,
          ),
        ),
        Material(
          color: AppTheme.playerAccent,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: () {
              HapticFeedback.lightImpact();
              audio.togglePlayPause();
            },
            child: SizedBox(
              width: 72,
              height: 72,
              child: Icon(
                phase.isPlaying
                    ? Icons.pause_rounded
                    : Icons.play_arrow_rounded,
                size: 40,
                color: Colors.black,
              ),
            ),
          ),
        ),
        IconButton(
          tooltip: 'Bài tiếp',
          onPressed: audio.hasNext ? audio.next : null,
          iconSize: 40,
          icon: Icon(
            Icons.skip_next_rounded,
            color:
                audio.hasNext ? Colors.white : AppTheme.playerTextTertiary,
          ),
        ),
        IconButton(
          tooltip: switch (repeat) {
            Mp3RepeatMode.off => 'Lặp lại',
            Mp3RepeatMode.all => 'Lặp danh sách',
            Mp3RepeatMode.one => 'Lặp một bài',
          },
          onPressed: audio.cycleRepeatMode,
          icon: Icon(
            repeat == Mp3RepeatMode.one
                ? Icons.repeat_one_rounded
                : Icons.repeat_rounded,
            color: repeatOn
                ? AppTheme.playerAccent
                : AppTheme.playerTextSecondary,
          ),
        ),
      ],
    );
  }
}
