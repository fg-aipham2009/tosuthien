import 'package:flutter/material.dart';

import '../models/chat_models.dart';
import '../state/chat_controller.dart';

class ChatHistorySidebar extends StatelessWidget {
  const ChatHistorySidebar({
    super.key,
    required this.controller,
    this.onItemTap,
  });

  final ChatController controller;
  final VoidCallback? onItemTap;

  Future<void> _confirmDelete(
    BuildContext context,
    ChatController controller,
    ChatConversation item,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        final colors = Theme.of(ctx).colorScheme;
        return AlertDialog(
          title: const Text('Xóa hội thoại?'),
          content: Text(
            '「${item.title}」 sẽ bị xóa và không thể khôi phục.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Hủy'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: colors.error,
                foregroundColor: colors.onError,
              ),
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Xóa'),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !context.mounted) return;

    await controller.deleteConversation(item.id);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: const Text('Đã xóa hội thoại'),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(milliseconds: 1600),
          margin: const EdgeInsets.fromLTRB(10, 0, 10, 12),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return ScaffoldMessenger(
      child: Scaffold(
        backgroundColor: colors.surfaceContainerLow,
        body: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
              child: Row(
                children: [
                  Icon(Icons.auto_awesome, size: 20, color: colors.primary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Hỏi đáp',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: OutlinedButton.icon(
                onPressed: () {
                  controller.newConversation();
                  onItemTap?.call();
                },
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Hội thoại mới'),
                style: OutlinedButton.styleFrom(
                  alignment: Alignment.centerLeft,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  side: BorderSide(
                    color: colors.outlineVariant.withValues(alpha: 0.6),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Text(
                'Gần đây',
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: colors.onSurfaceVariant,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
            Expanded(
              child: controller.conversations.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Text(
                          'Chưa có hội thoại.',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: colors.onSurfaceVariant,
                                height: 1.4,
                              ),
                        ),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(8, 4, 8, 12),
                      itemCount: controller.conversations.length,
                      itemBuilder: (context, index) {
                        final item = controller.conversations[index];
                        final selected =
                            item.id == controller.activeConversation?.id;

                        return Padding(
                          padding: const EdgeInsets.only(bottom: 2),
                          child: Material(
                            color: selected
                                ? colors.surfaceContainerHighest
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(10),
                              onTap: () {
                                controller.selectConversation(item.id);
                                onItemTap?.call();
                              },
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 10,
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      Icons.chat_bubble_outline_rounded,
                                      size: 16,
                                      color: selected
                                          ? colors.primary
                                          : colors.onSurfaceVariant,
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        item.title,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodyMedium
                                            ?.copyWith(
                                              fontWeight: selected
                                                  ? FontWeight.w600
                                                  : FontWeight.w400,
                                            ),
                                      ),
                                    ),
                                    IconButton(
                                      tooltip: 'Xóa',
                                      visualDensity: VisualDensity.compact,
                                      padding: EdgeInsets.zero,
                                      constraints: const BoxConstraints(
                                        minWidth: 32,
                                        minHeight: 32,
                                      ),
                                      onPressed: () => _confirmDelete(
                                        context,
                                        controller,
                                        item,
                                      ),
                                      icon: Icon(
                                        Icons.close_rounded,
                                        size: 16,
                                        color: colors.outline,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
      ),
    );
  }
}
