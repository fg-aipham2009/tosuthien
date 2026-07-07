import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import 'api_exception.dart';

class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<List<dynamic>> getList(String path, {Map<String, String>? query}) async {
    final body = await get(path, query: query);
    if (body is List) return body;
    throw ApiException('Expected JSON array from $path');
  }

  Future<Map<String, dynamic>> getObject(
    String path, {
    Map<String, String>? query,
  }) async {
    final body = await get(path, query: query);
    if (body is Map<String, dynamic>) return body;
    throw ApiException('Expected JSON object from $path');
  }

  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    return _get(path, query: query);
  }

  Future<dynamic> _get(String path, {Map<String, String>? query}) async {
    final uri = Uri.parse('${ApiConfig.api}$path').replace(queryParameters: query);
    final res = await _client.get(uri, headers: {'Accept': 'application/json'});

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return jsonDecode(utf8.decode(res.bodyBytes));
    }

    String message = 'HTTP ${res.statusCode}';
    try {
      final err = jsonDecode(res.body);
      if (err is Map && err['message'] != null) {
        message = '${err['message']}';
      }
    } catch (_) {
      message = res.body.isNotEmpty ? res.body : message;
    }
    throw ApiException(message, statusCode: res.statusCode);
  }

  void dispose() => _client.close();

  Future<Map<String, dynamic>> post(
    String path,
    Map<String, dynamic> body,
  ) async {
    return _sendJson('POST', path, body);
  }

  Future<Map<String, dynamic>> put(
    String path,
    Map<String, dynamic> body,
  ) async {
    return _sendJson('PUT', path, body);
  }

  Future<Map<String, dynamic>> _sendJson(
    String method,
    String path,
    Map<String, dynamic> body,
  ) async {
    final uri = Uri.parse('${ApiConfig.api}$path');
    final headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
    };
    final encoded = utf8.encode(jsonEncode(body));

    final http.Response res;
    switch (method) {
      case 'PUT':
        res = await _client.put(uri, headers: headers, body: encoded);
      case 'POST':
        res = await _client.post(uri, headers: headers, body: encoded);
      default:
        throw ApiException('Unsupported method $method');
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (res.bodyBytes.isEmpty) return {};
      final decoded = jsonDecode(utf8.decode(res.bodyBytes));
      if (decoded is Map<String, dynamic>) return decoded;
      throw ApiException('Expected JSON object from $path');
    }

    String message = 'HTTP ${res.statusCode}';
    try {
      final err = jsonDecode(res.body);
      if (err is Map && err['message'] != null) {
        message = '${err['message']}';
      }
    } catch (_) {
      message = res.body.isNotEmpty ? res.body : message;
    }
    throw ApiException(message, statusCode: res.statusCode);
  }
}
