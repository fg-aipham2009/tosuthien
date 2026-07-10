import 'package:flutter/material.dart';

import '../../chat/presentation/chat_screen.dart';
import '../../mp3/presentation/mp3_screen.dart';
import '../../books/presentation/books_screen.dart';
import '../../centers/presentation/centers_screen.dart';
import '../../me/presentation/me_screen.dart';

class AppTab {
  const AppTab({
    required this.title,
    required this.icon,
    required this.selectedIcon,
    required this.screen,
  });

  final String title;
  final IconData icon;
  final IconData selectedIcon;
  final Widget screen;

  static const tabs = [
    AppTab(
      title: 'Hỏi đáp',
      icon: Icons.chat_bubble_outline,
      selectedIcon: Icons.chat_bubble,
      screen: ChatScreen(),
    ),
    AppTab(
      title: 'MP3',
      icon: Icons.headphones_outlined,
      selectedIcon: Icons.headphones,
      screen: Mp3Screen(),
    ),
    AppTab(
      title: 'Kinh sách',
      icon: Icons.menu_book_outlined,
      selectedIcon: Icons.menu_book,
      screen: BooksScreen(),
    ),
    AppTab(
      title: 'Thiền đường',
      icon: Icons.temple_buddhist_outlined,
      selectedIcon: Icons.temple_buddhist,
      screen: CentersScreen(),
    ),
    AppTab(
      title: 'Me',
      icon: Icons.person_outline,
      selectedIcon: Icons.person,
      screen: MeScreen(),
    ),
  ];
}
