import 'package:flutter/material.dart';

import 'mp3_favorites_store.dart';

class Mp3FavoritesScope extends InheritedNotifier<Mp3FavoritesStore> {
  const Mp3FavoritesScope({
    super.key,
    required Mp3FavoritesStore store,
    required super.child,
  }) : super(notifier: store);

  static Mp3FavoritesStore of(BuildContext context) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<Mp3FavoritesScope>();
    assert(scope != null, 'Mp3FavoritesScope not found');
    return scope!.notifier!;
  }

  static Mp3FavoritesStore? maybeOf(BuildContext context) {
    return context
        .dependOnInheritedWidgetOfExactType<Mp3FavoritesScope>()
        ?.notifier;
  }
}
