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
