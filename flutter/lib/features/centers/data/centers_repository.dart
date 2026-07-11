import '../../../core/network/api_client.dart';
import '../models/center_models.dart';

class CentersRepository {
  CentersRepository({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<MeditationCenter>> fetchCenters({String? region}) async {
    final query = <String, String>{};
    if (region != null && region.isNotEmpty) {
      query['region'] = region;
    }

    final rows = await _client.getList(
      '/centers',
      query: query.isEmpty ? null : query,
    );

    return rows
        .whereType<Map<String, dynamic>>()
        .map(MeditationCenter.fromJson)
        .toList();
  }

  Future<MeditationCenter> fetchCenter(String id) async {
    final json = await _client.getObject('/centers/$id');
    return MeditationCenter.fromJson(json);
  }

  void dispose() => _client.dispose();
}
