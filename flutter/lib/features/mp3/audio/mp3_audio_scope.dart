import 'package:flutter/widgets.dart';

import 'mp3_audio_controller.dart';

class Mp3AudioScope extends InheritedNotifier<Mp3AudioController> {
  const Mp3AudioScope({
    super.key,
    required Mp3AudioController controller,
    required super.child,
  }) : super(notifier: controller);

  static Mp3AudioController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<Mp3AudioScope>();
    assert(scope != null, 'Mp3AudioScope not found');
    return scope!.notifier!;
  }
}
