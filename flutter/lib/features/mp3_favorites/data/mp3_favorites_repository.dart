import '../../../core/device/device_id.dart';
import '../../../core/network/api_client.dart';
import '../../mp3/models/mp3_track.dart';
import '../../offline_mp3/models/saved_mp3_track.dart';

class Mp3FavoritesRepository {
  Mp3FavoritesRepository({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<SavedMp3Track>> fetchFavorites() async {
    final deviceId = await DeviceId.get();
    final rows = await _client.getList(
      '/mp3/favorites',
      query: {'device_id': deviceId},
    );

    return rows.whereType<Map<String, dynamic>>().map((json) {
      final track = Mp3Track.fromJson(json);
      final favoritedAt = json['favoritedAt'] is String
          ? DateTime.tryParse(json['favoritedAt'] as String)
          : DateTime.now();
      return SavedMp3Track.fromTrack(track, favoritedAt: favoritedAt);
    }).toList();
  }

  Future<Set<String>> fetchFavoriteIds() async {
    final deviceId = await DeviceId.get();
    final json = await _client.getObject(
      '/mp3/favorites/ids',
      query: {'device_id': deviceId},
    );
    final ids = json['ids'];
    if (ids is! List) return {};
    return ids.whereType<String>().toSet();
  }

  Future<bool> toggle(String mp3TrackId) async {
    final deviceId = await DeviceId.get();
    final json = await _client.post('/mp3/favorites/toggle', {
      'deviceId': deviceId,
      'mp3TrackId': mp3TrackId,
    });
    return json['favorited'] == true;
  }

  void dispose() => _client.dispose();
}
