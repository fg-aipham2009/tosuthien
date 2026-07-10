import 'package:flutter/material.dart';

import '../features/mp3/audio/mp3_audio_controller.dart';
import '../features/mp3/audio/mp3_audio_scope.dart';
import '../features/mp3_favorites/state/mp3_favorites_scope.dart';
import '../features/mp3_favorites/state/mp3_favorites_store.dart';
import '../features/offline_books/state/offline_books_library.dart';
import '../features/offline_books/state/offline_books_scope.dart';
import '../features/offline_mp3/state/offline_mp3_library.dart';
import '../features/offline_mp3/state/offline_mp3_scope.dart';
import 'theme.dart';
import '../features/shell/presentation/home_screen.dart';

class ToSuThienApp extends StatefulWidget {
  const ToSuThienApp({super.key});

  @override
  State<ToSuThienApp> createState() => _ToSuThienAppState();
}

class _ToSuThienAppState extends State<ToSuThienApp> {
  late final Mp3FavoritesStore _favorites;
  late final OfflineMp3Library _offlineMp3;
  late final OfflineBooksLibrary _offlineBooks;
  late final Mp3AudioController _audio;

  @override
  void initState() {
    super.initState();
    _favorites = Mp3FavoritesStore();
    _offlineMp3 = OfflineMp3Library();
    _offlineBooks = OfflineBooksLibrary();
    _audio = Mp3AudioController(offlineLibrary: _offlineMp3);
    _favorites.init();
    _offlineMp3.init();
    _offlineBooks.init();
  }

  @override
  void dispose() {
    _audio.dispose();
    _favorites.dispose();
    _offlineMp3.dispose();
    _offlineBooks.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Mp3FavoritesScope(
      store: _favorites,
      child: OfflineMp3Scope(
        library: _offlineMp3,
        child: OfflineBooksScope(
          library: _offlineBooks,
          child: Mp3AudioScope(
            controller: _audio,
            child: MaterialApp(
              title: 'Tổ Sư Thiền',
              debugShowCheckedModeBanner: false,
              theme: AppTheme.light,
              home: const HomeScreen(),
            ),
          ),
        ),
      ),
    );
  }
}
