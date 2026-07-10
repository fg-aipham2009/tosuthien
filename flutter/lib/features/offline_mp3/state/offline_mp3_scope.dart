import 'package:flutter/material.dart';

import 'offline_mp3_library.dart';

class OfflineMp3Scope extends InheritedNotifier<OfflineMp3Library> {
  const OfflineMp3Scope({
    super.key,
    required OfflineMp3Library library,
    required super.child,
  }) : super(notifier: library);

  static OfflineMp3Library of(BuildContext context) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<OfflineMp3Scope>();
    assert(scope != null, 'OfflineMp3Scope not found in widget tree');
    return scope!.notifier!;
  }

  static OfflineMp3Library? maybeOf(BuildContext context) {
    return context
        .dependOnInheritedWidgetOfExactType<OfflineMp3Scope>()
        ?.notifier;
  }
}
