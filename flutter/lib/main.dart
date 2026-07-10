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
      androidNotificationChannelId: 'com.tosuthien.tosuthien.audio',
      androidNotificationChannelName: 'Pháp âm',
      androidNotificationOngoing: true,
      androidStopForegroundOnPause: true,
    );
  }
  runApp(const ToSuThienApp());
}
