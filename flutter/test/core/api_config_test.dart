import 'package:flutter_test/flutter_test.dart';
import 'package:tosuthien/core/config/api_config.dart';

void main() {
  test('ApiConfig default origin maps to /api REST root', () {
    // Default in api_config.dart is https://api.tosuthien.net/
    expect(ApiConfig.baseUrl, 'https://api.tosuthien.net');
    expect(ApiConfig.api, 'https://api.tosuthien.net/api');
  });
}
