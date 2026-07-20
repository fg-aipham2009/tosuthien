import 'package:flutter/material.dart';

import '../state/chat_controller.dart';

/// Book filter for multi-turn RAG — always visible above the composer.
class ChatBookFilterBar extends StatelessWidget {
  const ChatBookFilterBar({super.key, required this.controller});

  final ChatController controller;

  Future<void> _openPicker(BuildContext context) async {
    if (controller.sources.isEmpty && !controller.sourcesLoading) {
      await controller.loadSources();
    }
    if (!context.mounted) return;

    final selected = {...controller.selectedSourceFiles};
    final colors = Theme.of(context).colorScheme;

    await showDialog<void>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final sources = controller.sources;
            final size = MediaQuery.sizeOf(ctx);
            return Dialog(
              insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: 440,
                  maxHeight: size.height * 0.78,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 16, 8, 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Chọn sách để hỏi',
                              style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ),
                          IconButton(
                            tooltip: 'Đóng',
                            onPressed: () => Navigator.of(ctx).pop(),
                            icon: const Icon(Icons.close),
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Text(
                        selected.isEmpty
                            ? 'Chưa chọn → hỏi trong toàn bộ kho. Tick sách để giới hạn câu trả lời (giữ qua các lượt hỏi tiếp).'
                            : 'Đã chọn ${selected.length} sách — mọi câu hỏi tiếp theo chỉ lấy từ các sách này.',
                        style: Theme.of(ctx).textTheme.bodySmall?.copyWith(
                              color: colors.onSurfaceVariant,
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
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              itemCount: sources.length,
                              itemBuilder: (ctx, i) {
                                final book = sources[i];
                                final checked =
                                    selected.contains(book.sourceFile);
                                return CheckboxListTile(
                                  value: checked,
                                  dense: true,
                                  controlAffinity:
                                      ListTileControlAffinity.leading,
                                  title: Text(
                                    book.displayTitle,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
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
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
                      child: Row(
                        children: [
                          TextButton(
                            onPressed: () {
                              setModalState(selected.clear);
                            },
                            child: const Text('Tất cả sách'),
                          ),
                          const Spacer(),
                          TextButton(
                            onPressed: () => Navigator.of(ctx).pop(),
                            child: const Text('Hủy'),
                          ),
                          const SizedBox(width: 8),
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
    final hasFilter = selected.isNotEmpty;
    final title = hasFilter ? controller.filterLabel : 'Tất cả sách';
    final subtitle = hasFilter
        ? 'Đang lọc ${selected.length} sách — bấm để đổi (giữ qua multi-turn)'
        : 'Bấm để chọn sách trước khi hỏi (multi-turn)';

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Material(
        color: hasFilter
            ? colors.secondaryContainer
            : colors.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: () => _openPicker(context),
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
            child: Row(
              children: [
                Icon(
                  hasFilter ? Icons.filter_alt : Icons.menu_book_outlined,
                  size: 22,
                  color: hasFilter
                      ? colors.onSecondaryContainer
                      : colors.primary,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Lọc sách: $title',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: hasFilter
                                  ? colors.onSecondaryContainer
                                  : colors.onSurface,
                            ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: hasFilter
                                  ? colors.onSecondaryContainer
                                      .withValues(alpha: 0.85)
                                  : colors.onSurfaceVariant,
                            ),
                      ),
                    ],
                  ),
                ),
                if (hasFilter)
                  IconButton(
                    tooltip: 'Bỏ lọc sách',
                    visualDensity: VisualDensity.compact,
                    icon: Icon(
                      Icons.close,
                      size: 18,
                      color: colors.onSecondaryContainer,
                    ),
                    onPressed: controller.clearSourceFilter,
                  )
                else
                  Icon(
                    Icons.expand_more,
                    color: colors.onSurfaceVariant,
                  ),
                if (!hasFilter) const SizedBox(width: 8),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
