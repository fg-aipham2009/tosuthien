import 'package:flutter/material.dart';

abstract final class AppTheme {
  static const _seedColor = Color(0xFF5D4037);

  static const mp3HeaderGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF3E2723), Color(0xFF6D4C41)],
  );

  static const mp3AccentGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF8D6E63), Color(0xFF5D4037)],
  );

  /// Spotify/Zing-style Now Playing palette (dark canvas + brand accent).
  static const playerCanvas = Color(0xFF121212);
  static const playerSurface = Color(0xFF282828);
  static const playerAccent = Color(0xFFD4A574);
  static const playerAccentPressed = Color(0xFFB8895A);
  static const playerTextSecondary = Color(0xFFB3B3B3);
  static const playerTextTertiary = Color(0xFF6A6A6A);

  static ThemeData get light => ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: _seedColor,
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(centerTitle: true),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: _seedColor,
            foregroundColor: Colors.white,
          ),
        ),
      );
}
