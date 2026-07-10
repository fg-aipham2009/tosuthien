import 'package:flutter/foundation.dart';

import '../../mp3/models/mp3_track.dart';
import '../../offline_mp3/models/saved_mp3_track.dart';
import '../data/mp3_favorites_repository.dart';

/// Favorites from DB (device_id) — online streaming only, no local files.
class Mp3FavoritesStore extends ChangeNotifier {
  Mp3FavoritesStore({Mp3FavoritesRepository? repository})
      : _repository = repository ?? Mp3FavoritesRepository();

  final Mp3FavoritesRepository _repository;
  final Map<String, SavedMp3Track> _byId = {};
  bool _ready = false;
  String? _lastError;

  bool get isReady => _ready;
  String? get lastError => _lastError;

  List<SavedMp3Track> get items {
    final list = _byId.values.toList();
    list.sort((a, b) => (b.favoritedAt ?? DateTime(0))
        .compareTo(a.favoritedAt ?? DateTime(0)));
    return list;
  }

  bool isFavorite(String trackId) => _byId.containsKey(trackId);

  Future<void> init() async {
    try {
      final list = await _repository.fetchFavorites();
      _byId
        ..clear()
        ..addEntries(list.map((t) => MapEntry(t.id, t)));
      _lastError = null;
      _ready = true;
    } catch (e) {
      _ready = true;
      _lastError = e.toString();
      debugPrint('Mp3FavoritesStore init failed: $e');
    }
    notifyListeners();
  }

  Future<void> refresh() => init();

  Future<void> toggle(Mp3Track track) async {
    final wasFavorite = _byId.containsKey(track.id);

    // Optimistic UI update
    if (wasFavorite) {
      _byId.remove(track.id);
    } else {
      _byId[track.id] = SavedMp3Track.fromTrack(
        track,
        favoritedAt: DateTime.now(),
      );
    }
    notifyListeners();

    try {
      final favorited = await _repository.toggle(track.id);
      if (favorited && !_byId.containsKey(track.id)) {
        _byId[track.id] = SavedMp3Track.fromTrack(
          track,
          favoritedAt: DateTime.now(),
        );
      } else if (!favorited) {
        _byId.remove(track.id);
      }
      _lastError = null;
    } catch (e) {
      // Roll back
      if (wasFavorite) {
        _byId[track.id] = SavedMp3Track.fromTrack(
          track,
          favoritedAt: DateTime.now(),
        );
      } else {
        _byId.remove(track.id);
      }
      _lastError = e.toString();
      debugPrint('Mp3FavoritesStore toggle failed: $e');
      rethrow;
    } finally {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _repository.dispose();
    super.dispose();
  }
}
