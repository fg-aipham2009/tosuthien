import 'package:flutter/material.dart';

import 'offline_books_library.dart';

class OfflineBooksScope extends InheritedNotifier<OfflineBooksLibrary> {
  const OfflineBooksScope({
    super.key,
    required OfflineBooksLibrary library,
    required super.child,
  }) : super(notifier: library);

  static OfflineBooksLibrary of(BuildContext context) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<OfflineBooksScope>();
    assert(scope != null, 'OfflineBooksScope not found');
    return scope!.notifier!;
  }

  static OfflineBooksLibrary? maybeOf(BuildContext context) {
    return context
        .dependOnInheritedWidgetOfExactType<OfflineBooksScope>()
        ?.notifier;
  }
}
