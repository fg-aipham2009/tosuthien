import 'package:flutter/material.dart';

import '../../../app/theme.dart';

/// Shared playback state for list tiles and the mini player bar.
enum Mp3PlaybackPhase {
  /// Not the current track.
  idle,

  /// Current track, paused.
  paused,

  /// Current track, playing.
  playing,
}

extension Mp3PlaybackPhaseX on Mp3PlaybackPhase {
  bool get isActive => this != Mp3PlaybackPhase.idle;
  bool get isPlaying => this == Mp3PlaybackPhase.playing;

  static Mp3PlaybackPhase resolve({
    required bool isActive,
    required bool isPlaying,
  }) {
    if (!isActive) return Mp3PlaybackPhase.idle;
    return isPlaying ? Mp3PlaybackPhase.playing : Mp3PlaybackPhase.paused;
  }

  String? get statusLabel => switch (this) {
        Mp3PlaybackPhase.playing => 'Đang phát',
        Mp3PlaybackPhase.paused => 'Tạm dừng',
        Mp3PlaybackPhase.idle => null,
      };

  IconData get artworkIcon => switch (this) {
        Mp3PlaybackPhase.playing => Icons.graphic_eq_rounded,
        Mp3PlaybackPhase.paused => Icons.pause_rounded,
        Mp3PlaybackPhase.idle => Icons.music_note_rounded,
      };

  IconData get actionIcon =>
      isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded;

  IconData get compactActionIcon =>
      isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded;
}

/// Artwork badge that shows idle / paused / playing consistently.
class Mp3PlaybackArtwork extends StatelessWidget {
  const Mp3PlaybackArtwork({
    super.key,
    required this.phase,
    this.size = 48,
    this.borderRadius = 14,
  });

  final Mp3PlaybackPhase phase;
  final double size;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: phase.isActive
            ? AppTheme.mp3HeaderGradient
            : AppTheme.mp3AccentGradient,
        borderRadius: BorderRadius.circular(borderRadius),
      ),
      child: Icon(
        phase.artworkIcon,
        color: Colors.white,
        size: size * 0.5,
      ),
    );
  }
}

/// Title + optional meta, styled by shared playback phase.
class Mp3PlaybackTitleBlock extends StatelessWidget {
  const Mp3PlaybackTitleBlock({
    super.key,
    required this.title,
    required this.phase,
    this.metaParts = const [],
    this.maxTitleLines = 2,
  });

  final String title;
  final Mp3PlaybackPhase phase;
  final List<String> metaParts;
  final int maxTitleLines;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final meta = [
      ...metaParts,
      if (phase.statusLabel != null) phase.statusLabel!,
    ].where((s) => s.isNotEmpty).join(' · ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          maxLines: maxTitleLines,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: phase.isActive ? FontWeight.w700 : FontWeight.w600,
                color: phase.isActive ? colors.primary : colors.onSurface,
                height: 1.35,
              ),
        ),
        if (meta.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(
            meta,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: colors.onSurfaceVariant,
                  height: 1.35,
                ),
          ),
        ],
      ],
    );
  }
}

/// Play / pause control that matches [phase] (list + mini bar).
class Mp3PlaybackActionButton extends StatelessWidget {
  const Mp3PlaybackActionButton({
    super.key,
    required this.phase,
    required this.onPressed,
    this.compact = false,
  });

  final Mp3PlaybackPhase phase;
  final VoidCallback? onPressed;
  final bool compact;

  static const double _box = 40;
  static const double _iconSize = 22;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    if (compact) {
      return SizedBox(
        width: _box,
        height: _box,
        child: IconButton(
          onPressed: onPressed,
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints.tightFor(width: _box, height: _box),
          icon: Icon(phase.compactActionIcon, size: _iconSize),
          style: IconButton.styleFrom(
            backgroundColor: colors.primaryContainer,
            foregroundColor: colors.onPrimaryContainer,
          ),
        ),
      );
    }

    return SizedBox(
      width: _box,
      height: _box,
      child: IconButton(
        onPressed: onPressed,
        padding: EdgeInsets.zero,
        constraints: const BoxConstraints.tightFor(width: _box, height: _box),
        icon: Icon(
          phase.actionIcon,
          size: _iconSize,
          color: phase.isActive
              ? colors.primary
              : colors.onSurfaceVariant,
        ),
      ),
    );
  }
}
