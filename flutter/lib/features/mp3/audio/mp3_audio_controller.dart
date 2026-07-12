import 'dart:async';

import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../offline_mp3/state/offline_mp3_library.dart';
import '../models/mp3_track.dart';

enum Mp3RepeatMode { off, all, one }

class Mp3AudioController extends ChangeNotifier {
  Mp3AudioController({OfflineMp3Library? offlineLibrary})
      : _offlineLibrary = offlineLibrary {
    _init();
  }

  final AudioPlayer _player = AudioPlayer();
  final OfflineMp3Library? _offlineLibrary;

  List<Mp3Track> _queue = [];
  List<Mp3Track> _orderQueue = [];
  int _index = 0;
  Duration _position = Duration.zero;
  Duration? _duration;
  bool _loadingTrack = false;
  bool _shuffle = false;
  Mp3RepeatMode _repeatMode = Mp3RepeatMode.off;
  final List<StreamSubscription<dynamic>> _subscriptions = [];

  List<Mp3Track> get queue => List.unmodifiable(_queue);
  Mp3Track? get currentTrack =>
      _queue.isEmpty || _index < 0 || _index >= _queue.length
          ? null
          : _queue[_index];
  bool get isPlaying => _player.playing;
  bool get isLoadingTrack => _loadingTrack;
  Duration get position => _position;
  Duration? get duration => _duration ?? currentTrack?.duration;
  bool get shuffle => _shuffle;
  Mp3RepeatMode get repeatMode => _repeatMode;
  bool get hasPrevious => currentTrack != null;
  bool get hasNext =>
      currentTrack != null &&
      (_index < _queue.length - 1 || _repeatMode == Mp3RepeatMode.all);

  Future<void> _init() async {
    final session = await AudioSession.instance;
    await session.configure(const AudioSessionConfiguration.music());

    _subscriptions.addAll([
      _player.playerStateStream.listen((_) => notifyListeners()),
      _player.positionStream.listen((position) {
        _position = position;
        notifyListeners();
      }),
      _player.durationStream.listen((duration) {
        _duration = duration;
        notifyListeners();
      }),
      _player.processingStateStream.listen((state) async {
        if (state != ProcessingState.completed || _loadingTrack) return;
        await _onTrackCompleted();
      }),
    ]);
  }

  Future<void> _onTrackCompleted() async {
    if (_repeatMode == Mp3RepeatMode.one) {
      await seek(Duration.zero);
      await _player.play();
      return;
    }
    if (_index < _queue.length - 1) {
      await next();
      return;
    }
    if (_repeatMode == Mp3RepeatMode.all && _queue.isNotEmpty) {
      _index = 0;
      notifyListeners();
      await _loadAndPlayCurrent();
      return;
    }
    notifyListeners();
  }

  void toggleShuffle() {
    final current = currentTrack;
    _shuffle = !_shuffle;
    if (_orderQueue.isEmpty) {
      _orderQueue = List.of(_queue);
    }
    if (_shuffle) {
      final rest = List<Mp3Track>.of(_queue);
      if (current != null) rest.removeWhere((t) => t.id == current.id);
      rest.shuffle();
      _queue = [?current, ...rest];
      _index = 0;
    } else {
      _queue = List.of(_orderQueue);
      if (current != null) {
        final i = _queue.indexWhere((t) => t.id == current.id);
        _index = i < 0 ? 0 : i;
      }
    }
    notifyListeners();
  }

  void cycleRepeatMode() {
    _repeatMode = switch (_repeatMode) {
      Mp3RepeatMode.off => Mp3RepeatMode.all,
      Mp3RepeatMode.all => Mp3RepeatMode.one,
      Mp3RepeatMode.one => Mp3RepeatMode.off,
    };
    notifyListeners();
  }

  /// Android 13+ needs notification permission for lock-screen media controls.
  Future<void> _ensureLockScreenControlsPermission() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    final status = await Permission.notification.status;
    if (status.isGranted || status.isLimited) return;
    await Permission.notification.request();
  }

  /// Assign playlist immediately (for UI) without waiting for network I/O.
  void prepareQueue(List<Mp3Track> tracks, {int startIndex = 0}) {
    if (tracks.isEmpty) return;
    _orderQueue = List.of(tracks);
    final start = startIndex.clamp(0, tracks.length - 1);
    if (_shuffle) {
      final current = tracks[start];
      final rest = List<Mp3Track>.of(tracks)..removeAt(start);
      rest.shuffle();
      _queue = [current, ...rest];
      _index = 0;
    } else {
      _queue = List.of(tracks);
      _index = start;
    }
    notifyListeners();
  }

  /// Start (or restart) playback for [tracks] at [startIndex].
  ///
  /// Loads only the selected track so large folders play immediately (Zing-style).
  Future<void> playQueue(List<Mp3Track> tracks, {int startIndex = 0}) async {
    if (tracks.isEmpty) return;
    prepareQueue(tracks, startIndex: startIndex);
    await _ensureLockScreenControlsPermission();
    await _loadAndPlayCurrent();
  }

  /// Play whatever is currently selected in [_queue] (after [prepareQueue]).
  Future<void> playPrepared() async {
    if (currentTrack == null) return;
    await _ensureLockScreenControlsPermission();
    await _loadAndPlayCurrent();
  }

  /// Same track → toggle pause/play; different track → start that queue item.
  Future<void> playOrToggle(
    List<Mp3Track> tracks, {
    required int startIndex,
  }) async {
    if (tracks.isEmpty) return;
    final index = startIndex.clamp(0, tracks.length - 1);
    final target = tracks[index];
    final current = currentTrack;

    if (current != null && current.id == target.id && !_loadingTrack) {
      await togglePlayPause();
      return;
    }

    await playQueue(tracks, startIndex: index);
  }

  Future<void> togglePlayPause() async {
    if (currentTrack == null) return;
    if (_player.playing) {
      await _player.pause();
    } else {
      await _ensureLockScreenControlsPermission();
      await _player.play();
    }
    notifyListeners();
  }

  Future<void> seek(Duration position) => _player.seek(position);

  Future<void> previous() async {
    // Spotify-style: restart current track after a few seconds, else go back.
    if (_position.inSeconds >= 3) {
      await seek(Duration.zero);
      return;
    }
    if (_index > 0) {
      _index -= 1;
    } else if (_repeatMode == Mp3RepeatMode.all && _queue.isNotEmpty) {
      _index = _queue.length - 1;
    } else {
      await seek(Duration.zero);
      return;
    }
    notifyListeners();
    await _loadAndPlayCurrent();
  }

  Future<void> next() async {
    if (_index < _queue.length - 1) {
      _index += 1;
    } else if (_repeatMode == Mp3RepeatMode.all && _queue.isNotEmpty) {
      _index = 0;
    } else {
      await _player.stop();
      notifyListeners();
      return;
    }
    notifyListeners();
    await _loadAndPlayCurrent();
  }

  Future<void> stop() async {
    await _player.stop();
    _queue = [];
    _orderQueue = [];
    _index = 0;
    _position = Duration.zero;
    _duration = null;
    notifyListeners();
  }

  Future<void> _loadAndPlayCurrent() async {
    final track = currentTrack;
    if (track == null) return;

    _loadingTrack = true;
    _position = Duration.zero;
    _duration = null;
    notifyListeners();

    try {
      final source = await _sourceFor(track);
      await _player.setAudioSource(source);
      await _player.play();
    } finally {
      _loadingTrack = false;
      notifyListeners();
    }
  }

  Future<AudioSource> _sourceFor(Mp3Track track) async {
    // Prefer isolated local file when downloaded; otherwise stream online URL.
    final uri = _offlineLibrary == null
        ? Uri.parse(track.publicUrl)
        : await _offlineLibrary.playbackUriFor(track);

    return AudioSource.uri(
      uri,
      tag: MediaItem(
        id: track.id,
        album: track.categoryName ?? 'Pháp âm Tổ Sư Thiền',
        title: track.title,
        displayTitle: track.title,
        displaySubtitle: [
          if (track.categoryName != null) track.categoryName,
          if (track.year > 0) '${track.year}',
        ].whereType<String>().join(' · '),
        playable: true,
      ),
    );
  }

  @override
  void dispose() {
    for (final sub in _subscriptions) {
      sub.cancel();
    }
    _player.dispose();
    super.dispose();
  }
}
