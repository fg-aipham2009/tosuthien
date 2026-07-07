import '../../../../core/network/api_client.dart';
import '../models/mp3_folder_listing.dart';
import '../models/mp3_track.dart';

class Mp3FolderBrowseResult {
  const Mp3FolderBrowseResult({
    required this.listing,
    required this.tracks,
  });

  final Mp3FolderListing listing;
  final List<Mp3Track> tracks;
}

class Mp3Repository {
  Mp3Repository({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Mp3FolderListing> fetchFolderListing({String path = ''}) async {
    final json = await _client.getObject(
      '/files/list',
      query: {'root': 'mp3', if (path.isNotEmpty) 'path': path},
    );
    return Mp3FolderListing.fromJson(json);
  }

  Future<Mp3FolderBrowseResult> fetchFolderBrowse({String path = ''}) async {
    final listing = await fetchFolderListing(path: path);
    final tracks = await fetchTracks(folderPath: listing.currentPath);
    return Mp3FolderBrowseResult(listing: listing, tracks: tracks);
  }

  Future<List<Mp3Track>> fetchTracks({
    String? folderPath,
    int? year,
  }) async {
    final query = <String, String>{};
    if (folderPath != null && folderPath.isNotEmpty) {
      query['folder'] = folderPath;
    }
    if (year != null) query['year'] = '$year';

    final rows = await _client.getList(
      '/mp3/tracks',
      query: query.isEmpty ? null : query,
    );

    return rows
        .whereType<Map<String, dynamic>>()
        .map(Mp3Track.fromJson)
        .toList();
  }

  void dispose() => _client.dispose();
}
