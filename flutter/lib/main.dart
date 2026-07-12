import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:pdfrx/pdfrx.dart';

import 'app/app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await pdfrxFlutterInitialize();
  if (!kIsWeb) {
    await JustAudioBackground.init(
      androidNotificationChannelId: 'com.tosuthien.audio',
      androidNotificationChannelName: 'Pháp âm',
      androidNotificationOngoing: true,
      // Keep media notification (and lock-screen controls) while paused.
      androidStopForegroundOnPause: false,
    );
  }
  runApp(const ToSuThienApp());
}
