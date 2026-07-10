/// NestJS API origin. Override at build/run time:
///   --dart-define=API_BASE_URL=https://api.tosuthien.net/
/// Also accepts `.../api` — [api] always resolves to the REST root.
class ApiConfig {
  static const String _raw = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.tosuthien.net/',
  );

  /// Origin used for static files (`/files/...`), without trailing slash.
  static String get baseUrl {
    final u = _raw.trim().replaceAll(RegExp(r'/+$'), '');
    if (u.toLowerCase().endsWith('/api')) {
      return u.substring(0, u.length - 4);
    }
    return u;
  }

  /// REST API root (`.../api`), without trailing slash.
  static String get api {
    final u = _raw.trim().replaceAll(RegExp(r'/+$'), '');
    if (u.toLowerCase().endsWith('/api')) return u;
    return '$u/api';
  }
}
