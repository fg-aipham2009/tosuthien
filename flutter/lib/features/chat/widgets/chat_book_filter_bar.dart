import 'package:flutter/material.dart';

import '../state/chat_controller.dart';

/// Compact filter bar + multi-select sheet for RAG book filter.
class ChatBookFilterBar extends StatelessWidget {
  const ChatBookFilterBar({super.key, required this.controller});

  final ChatController controller;

  Future<void> _openPicker(BuildContext context) async {
    if (controller.sources.isEmpty && !controller.sourcesLoading) {
      await controller.loadSources();
    }
    if (!context.mounted) return;

    final selected = {...controller.selectedSourceFiles};
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final sources = controller.sources;
            return SafeArea(
              child: SizedBox(
                height: MediaQuery.sizeOf(ctx).height * 0.72,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 4, 12, 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Lọc theo sách',
                              style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ),
                          TextButton(
                            onPressed: () {
                              setModalState(selected.clear);
                            },
                            child: const Text('Tất cả'),
                          ),
                          FilledButton(
                            onPressed: () {
                              controller.setSourceFiles(selected.toList());
                              Navigator.of(ctx).pop();
                            },
                            child: const Text('Áp dụng'),
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Text(
                        selected.isEmpty
                            ? 'Đang hỏi trong toàn bộ kho kinh sách.'
                            : 'Đã chọn ${selected.length} sách — câu trả lời chỉ lấy từ các sách này.',
                        style: Theme.of(ctx).textTheme.bodySmall?.copyWith(
                              color: Theme.of(ctx).colorScheme.onSurfaceVariant,
                            ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Expanded(
                      child: sources.isEmpty
                          ? Center(
                              child: controller.sourcesLoading
                                  ? const CircularProgressIndicator()
                                  : const Text('Chưa tải được danh sách sách.'),
                            )
                          : ListView.builder(
                              itemCount: sources.length,
                              itemBuilder: (ctx, i) {
                                final book = sources[i];
                                final checked =
                                    selected.contains(book.sourceFile);
                                return CheckboxListTile(
                                  value: checked,
                                  dense: true,
                                  title: Text(
                                    book.title,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  subtitle: Text(book.sourceFile),
                                  onChanged: (v) {
                                    setModalState(() {
                                      if (v == true) {
                                        selected.add(book.sourceFile);
                                      } else {
                                        selected.remove(book.sourceFile);
                                      }
                                    });
                                  },
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final selected = controller.selectedSourceFiles;
    final label = controller.filterLabel;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ActionChip(
              avatar: Icon(
                selected.isEmpty ? Icons.menu_book_outlined : Icons.filter_alt,
                size: 18,
                color: colors.onSecondaryContainer,
              ),
              label: Text(label),
              backgroundColor: selected.isEmpty
                  ? colors.surfaceContainerHighest
                  : colors.secondaryContainer,
              onPressed: () => _openPicker(context),
            ),
            if (selected.isNotEmpty) ...[
              const SizedBox(width: 4),
              IconButton(
                tooltip: 'Bỏ lọc sách',
                visualDensity: VisualDensity.compact,
                icon: const Icon(Icons.close, size: 18),
                onPressed: controller.clearSourceFilter,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
