/// NestJS API base URL. Override at build/run time:
/// flutter run --dart-define=API_BASE_URL=http://192.168.1.x:8000
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:8000',
  );

  static String get api => '$baseUrl/api';
}
