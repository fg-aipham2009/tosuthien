import 'package:flutter/material.dart';

import '../features/mp3/audio/mp3_audio_controller.dart';
import '../features/mp3/audio/mp3_audio_scope.dart';
import 'theme.dart';
import '../features/shell/presentation/home_screen.dart';

class ToSuThienApp extends StatefulWidget {
  const ToSuThienApp({super.key});

  @override
  State<ToSuThienApp> createState() => _ToSuThienAppState();
}

class _ToSuThienAppState extends State<ToSuThienApp> {
  late final Mp3AudioController _audio;

  @override
  void initState() {
    super.initState();
    _audio = Mp3AudioController();
  }

  @override
  void dispose() {
    _audio.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Mp3AudioScope(
      controller: _audio,
      child: MaterialApp(
        title: 'Tổ Sư Thiền',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        home: const HomeScreen(),
      ),
    );
  }
}
