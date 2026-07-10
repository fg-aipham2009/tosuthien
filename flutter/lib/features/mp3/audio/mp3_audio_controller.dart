import 'dart:async';

import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';

import '../../offline_mp3/state/offline_mp3_library.dart';
import '../models/mp3_track.dart';

class Mp3AudioController extends ChangeNotifier {
  Mp3AudioController({OfflineMp3Library? offlineLibrary})
      : _offlineLibrary = offlineLibrary {
    _init();
  }

  final AudioPlayer _player = AudioPlayer();
  final OfflineMp3Library? _offlineLibrary;

  List<Mp3Track> _queue = [];
  int _index = 0;
  Duration _position = Duration.zero;
  Duration? _duration;
  final List<StreamSubscription<dynamic>> _subscriptions = [];

  List<Mp3Track> get queue => List.unmodifiable(_queue);
  Mp3Track? get currentTrack =>
      _queue.isEmpty || _index < 0 || _index >= _queue.length ? null : _queue[_index];
  bool get isPlaying => _player.playing;
  Duration get position => _position;
  Duration? get duration => _duration ?? currentTrack?.duration;
  bool get hasPrevious => _index > 0;
  bool get hasNext => _index < _queue.length - 1;

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
      _player.currentIndexStream.listen((index) {
        if (index != null && index >= 0 && index < _queue.length) {
          _index = index;
          notifyListeners();
        }
      }),
      _player.processingStateStream.listen((state) async {
        if (state == ProcessingState.completed && !hasNext) {
          notifyListeners();
        }
      }),
    ]);
  }

  Future<void> playQueue(List<Mp3Track> tracks, {int startIndex = 0}) async {
    if (tracks.isEmpty) return;
    _queue = List.of(tracks);
    _index = startIndex.clamp(0, _queue.length - 1);

    final children = <AudioSource>[];
    for (final track in _queue) {
      children.add(await _sourceFor(track));
    }

    final playlist = ConcatenatingAudioSource(children: children);

    await _player.setAudioSource(playlist, initialIndex: _index);
    await _player.play();
    notifyListeners();
  }

  /// Same track → toggle pause/play; different track → start that queue item.
  Future<void> playOrToggle(List<Mp3Track> tracks, {required int startIndex}) async {
    if (tracks.isEmpty) return;
    final index = startIndex.clamp(0, tracks.length - 1);
    final target = tracks[index];
    final current = currentTrack;

    if (current != null && current.id == target.id) {
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
      await _player.play();
    }
    notifyListeners();
  }

  Future<void> seek(Duration position) => _player.seek(position);

  Future<void> previous() async {
    if (!hasPrevious) {
      await seek(Duration.zero);
      return;
    }
    await _player.seekToPrevious();
    notifyListeners();
  }

  Future<void> next() async {
    if (!hasNext) {
      await _player.stop();
      notifyListeners();
      return;
    }
    await _player.seekToNext();
    notifyListeners();
  }

  Future<void> stop() async {
    await _player.stop();
    _queue = [];
    _index = 0;
    _position = Duration.zero;
    _duration = null;
    notifyListeners();
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
