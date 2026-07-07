import 'package:flutter/material.dart';

import '../../../app/theme.dart';
import '../models/mp3_folder_listing.dart';

class Mp3Breadcrumb extends StatelessWidget {
  const Mp3Breadcrumb({
    super.key,
    required this.folderPath,
  });

  final String folderPath;

  @override
  Widget build(BuildContext context) {
    if (folderPath.isEmpty) return const SizedBox.shrink();

    final colors = Theme.of(context).colorScheme;
    final segments = folderPath.replaceAll(RegExp(r'/+$'), '').split('/');

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Wrap(
        spacing: 4,
        runSpacing: 4,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Icon(Icons.home_outlined, size: 16, color: colors.primary),
          for (var i = 0; i < segments.length; i++) ...[
            Icon(Icons.chevron_right, size: 16, color: colors.outline),
            Text(
              segments[i],
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: i == segments.length - 1
                        ? colors.primary
                        : colors.onSurfaceVariant,
                    fontWeight:
                        i == segments.length - 1 ? FontWeight.w700 : FontWeight.w500,
                  ),
            ),
          ],
        ],
      ),
    );
  }
}

class Mp3FolderTile extends StatelessWidget {
  const Mp3FolderTile({
    super.key,
    required this.folderPath,
    required this.onTap,
    this.showDivider = false,
  });

  final String folderPath;
  final VoidCallback onTap;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final name = mp3FolderDisplayName(folderPath);
    final parent = folderPath.replaceAll(RegExp(r'/+$'), '');
    final parentPath = parent.contains('/')
        ? parent.substring(0, parent.lastIndexOf('/'))
        : '';

    return Column(
      children: [
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      gradient: AppTheme.mp3AccentGradient,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(
                      Icons.folder_rounded,
                      color: Colors.white,
                      size: 26,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w600,
                                height: 1.35,
                              ),
                        ),
                        if (parentPath.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            parentPath,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: colors.onSurfaceVariant,
                                  height: 1.35,
                                ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: colors.outline,
                    size: 28,
                  ),
                ],
              ),
            ),
          ),
        ),
        if (showDivider)
          Divider(
            height: 1,
            indent: 76,
            endIndent: 16,
            color: colors.outlineVariant.withValues(alpha: 0.5),
          ),
      ],
    );
  }
}

/// Rounded grouped container for list sections.
class Mp3GroupedList extends StatelessWidget {
  const Mp3GroupedList({
    super.key,
    required this.children,
  });

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: colors.outlineVariant.withValues(alpha: 0.45),
        ),
        boxShadow: [
          BoxShadow(
            color: colors.shadow.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: children,
      ),
    );
  }
}
