import 'package:flutter/material.dart';

import '../../mp3/audio/mp3_audio_scope.dart';
import '../../mp3/widgets/mp3_mini_player.dart';
import '../models/app_tab.dart';
import '../widgets/app_bottom_nav.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final tabs = AppTab.tabs;
    final audio = Mp3AudioScope.of(context);

    return Scaffold(
      appBar: _index == 0
          ? null
          : AppBar(
              title: Text(tabs[_index].title),
              centerTitle: true,
            ),
      body: IndexedStack(
        index: _index,
        children: [for (final tab in tabs) tab.screen],
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListenableBuilder(
            listenable: audio,
            builder: (context, _) => const Mp3MiniPlayer(),
          ),
          AppBottomNav(
            selectedIndex: _index,
            onSelected: (i) => setState(() => _index = i),
          ),
        ],
      ),
    );
  }
}
