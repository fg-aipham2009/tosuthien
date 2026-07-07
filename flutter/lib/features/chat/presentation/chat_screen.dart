import 'package:flutter/material.dart';

import '../state/chat_controller.dart';
import '../widgets/chat_composer.dart';
import '../widgets/chat_history_sidebar.dart';
import '../widgets/chat_message_bubble.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  static const contentMaxWidth = 768.0;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  late final ChatController _controller;
  final _scrollController = ScrollController();
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  static const _sidebarBreakpoint = 720.0;
  static const _sidebarWidth = 260.0;
  static const _contentMaxWidth = ChatScreen.contentMaxWidth;

  @override
  void initState() {
    super.initState();
    _controller = ChatController();
    _controller.addListener(_onControllerUpdate);
    _controller.init();
  }

  @override
  void dispose() {
    _controller.removeListener(_onControllerUpdate);
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onControllerUpdate() {
    if (mounted) {
      setState(() {});
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  void _openHistoryDrawer() {
    _scaffoldKey.currentState?.openDrawer();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final wide = MediaQuery.sizeOf(context).width >= _sidebarBreakpoint;

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: colors.surface,
      drawer: wide
          ? null
          : Drawer(
              width: _sidebarWidth,
              child: ChatHistorySidebar(
                controller: _controller,
                onItemTap: () => Navigator.of(context).pop(),
              ),
            ),
      body: Row(
        children: [
          if (wide)
            SizedBox(
              width: _sidebarWidth,
              child: ChatHistorySidebar(controller: _controller),
            ),
          if (wide)
            VerticalDivider(
              width: 1,
              thickness: 1,
              color: colors.outlineVariant.withValues(alpha: 0.35),
            ),
          Expanded(child: _buildChatPane(context, wide: wide)),
        ],
      ),
    );
  }

  Widget _buildChatPane(BuildContext context, {required bool wide}) {
    final colors = Theme.of(context).colorScheme;
    final messages = _controller.messages;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Material(
          color: colors.surface,
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
              child: Row(
                children: [
                  if (!wide)
                    IconButton(
                      tooltip: 'Lịch sử hội thoại',
                      onPressed: _openHistoryDrawer,
                      icon: const Icon(Icons.menu_rounded),
                    )
                  else
                    const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _controller.activeConversation?.title ?? 'Hỏi đáp kinh sách',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Hội thoại mới',
                    onPressed: _controller.newConversation,
                    icon: const Icon(Icons.edit_outlined, size: 22),
                  ),
                ],
              ),
            ),
          ),
        ),
        Divider(
          height: 1,
          color: colors.outlineVariant.withValues(alpha: 0.25),
        ),
        if (_controller.error != null)
          MaterialBanner(
            content: Text(_controller.error!),
            leading: const Icon(Icons.error_outline),
            backgroundColor: colors.errorContainer,
            actions: [
              TextButton(
                onPressed: _controller.clearError,
                child: const Text('Đóng'),
              ),
            ],
          ),
        Expanded(
          child: messages.isEmpty
              ? const ChatWelcome()
              : ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
                  itemCount: messages.length + (_controller.isLoading ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (index == messages.length) {
                      return const _LoadingRow();
                    }
                    return Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(
                          maxWidth: _contentMaxWidth,
                        ),
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 24),
                          child: ChatMessageBubble(message: messages[index]),
                        ),
                      ),
                    );
                  },
                ),
        ),
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: _contentMaxWidth),
            child: ChatComposer(
              isLoading: _controller.isLoading,
              onSend: _controller.sendMessage,
            ),
          ),
        ),
      ],
    );
  }
}

class _LoadingRow extends StatelessWidget {
  const _LoadingRow();

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: ChatScreen.contentMaxWidth),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            children: [
              SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: colors.primary,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'Đang tra cứu kinh sách…',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: colors.onSurfaceVariant,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
