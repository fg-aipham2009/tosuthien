import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/center_models.dart';

class CourseChip extends StatelessWidget {
  const CourseChip({super.key, required this.course, this.compact = false});

  final CenterCourse course;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, icon) = _style(course);
    final label = compact
        ? course.scheduleLabel
        : '${course.typeLabel}: ${course.scheduleLabel}';

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 5 : 6,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: course.isSeasonHighlight
            ? Border.all(color: fg.withValues(alpha: 0.45), width: 1.2)
            : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: compact ? 13 : 14, color: fg),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: fg,
                fontSize: compact ? 11.5 : 12,
                fontWeight:
                    course.isSeasonHighlight ? FontWeight.w700 : FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  static (Color, Color, IconData) _style(CenterCourse course) {
    if (course.isSpring) {
      return (
        const Color(0xFFE8F5E9),
        const Color(0xFF2E7D32),
        Icons.eco_rounded,
      );
    }
    if (course.isWinter) {
      return (
        const Color(0xFFE3F2FD),
        const Color(0xFF1565C0),
        Icons.ac_unit_rounded,
      );
    }
    if (course.isAnCu) {
      return (
        const Color(0xFFFFF8E1),
        const Color(0xFFF57F17),
        Icons.calendar_month_rounded,
      );
    }
    return (
      const Color(0xFFF5EDE6),
      const Color(0xFF5D4037),
      Icons.self_improvement_rounded,
    );
  }
}

class CenterListTile extends StatelessWidget {
  const CenterListTile({
    super.key,
    required this.center,
    required this.onTap,
  });

  final MeditationCenter center;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final imageUrl = center.resolvedImageUrl;
    final highlight = center.hasSeasonCourse;
    final phone = center.contactPhone;
    final address = _addressLine(center);
    final abbot = _abbotLine(center);

    // Season courses first so spring/winter stand out on the list.
    final courses = [...center.courses]..sort((a, b) {
        int rank(CenterCourse c) {
          if (c.isSpring || c.isWinter) return 0;
          if (c.isAnCu) return 1;
          return 2;
        }

        final d = rank(a).compareTo(rank(b));
        return d != 0 ? d : a.sortOrder.compareTo(b.sortOrder);
      });

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: highlight
              ? const Color(0xFF2E7D32).withValues(alpha: 0.5)
              : colors.outlineVariant.withValues(alpha: 0.45),
          width: highlight ? 1.5 : 1,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Thumb(imageUrl: imageUrl, hasCourses: center.hasCourses),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          center.templeName,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    height: 1.25,
                                  ),
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            if (center.hasSeasonCourse)
                              _Badge(
                                label: center.courses.any((c) => c.isWinter)
                                    ? (center.courses.any((c) => c.isSpring)
                                        ? 'Xuân · Đông'
                                        : 'Mùa đông')
                                    : 'Mùa xuân',
                                bg: const Color(0xFFE3F2FD),
                                fg: const Color(0xFF1565C0),
                              ),
                            if (center.hasCourses && !center.hasSeasonCourse)
                              _Badge(
                                label: 'Có khóa tu',
                                bg: colors.primary.withValues(alpha: 0.12),
                                fg: colors.primary,
                              ),
                            if (center.province != null &&
                                center.province!.isNotEmpty)
                              _Badge(
                                label: center.province!,
                                bg: colors.surfaceContainerHighest,
                                fg: colors.onSurfaceVariant,
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right_rounded, color: colors.outline),
                ],
              ),
              const SizedBox(height: 10),
              if (abbot != null)
                _InfoLine(
                  icon: Icons.person_outline_rounded,
                  label: 'Trụ trì',
                  value: abbot,
                ),
              if (phone != null) ...[
                const SizedBox(height: 6),
                _InfoLine(
                  icon: Icons.phone_outlined,
                  label: 'SĐT',
                  value: phone,
                  onValueTap: () => copyPhone(context, phone),
                ),
              ],
              if (address != null) ...[
                const SizedBox(height: 6),
                _InfoLine(
                  icon: Icons.place_outlined,
                  label: 'Địa chỉ',
                  value: address,
                  maxLines: 2,
                ),
              ],
              if (courses.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  'Khóa tu',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: colors.onSurfaceVariant,
                      ),
                ),
                const SizedBox(height: 6),
                ...courses.take(4).map(
                      (course) => Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(child: CourseChip(course: course)),
                          ],
                        ),
                      ),
                    ),
                if (courses.length > 4)
                  Text(
                    '+${courses.length - 4} khóa khác',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: colors.onSurfaceVariant,
                        ),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  static String? _abbotLine(MeditationCenter center) {
    final name = center.abbotDisplay;
    if (name.isEmpty) return null;
    final title = center.abbotTitle?.trim();
    if (title != null && title.isNotEmpty) return '$title · $name';
    return name;
  }

  static String? _addressLine(MeditationCenter center) {
    final parts = <String>[
      if (center.address != null && center.address!.trim().isNotEmpty)
        center.address!.trim(),
      if (center.province != null &&
          center.province!.trim().isNotEmpty &&
          !(center.address?.contains(center.province!) ?? false))
        center.province!.trim(),
    ];
    if (parts.isEmpty) return null;
    return parts.join(', ');
  }
}

class _Badge extends StatelessWidget {
  const _Badge({
    required this.label,
    required this.bg,
    required this.fg,
  });

  final String label;
  final Color bg;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: fg,
        ),
      ),
    );
  }
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({
    required this.icon,
    required this.label,
    required this.value,
    this.maxLines = 1,
    this.onValueTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final int maxLines;
  final VoidCallback? onValueTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: colors.onSurfaceVariant),
        const SizedBox(width: 6),
        SizedBox(
          width: 52,
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: colors.onSurfaceVariant,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ),
        Expanded(
          child: GestureDetector(
            onTap: onValueTap,
            child: Text(
              value,
              maxLines: maxLines,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: onValueTap != null ? colors.primary : null,
                    height: 1.3,
                  ),
            ),
          ),
        ),
      ],
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({required this.imageUrl, required this.hasCourses});

  final String? imageUrl;
  final bool hasCourses;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: SizedBox(
        width: 76,
        height: 76,
        child: imageUrl != null
            ? Image.network(
                imageUrl!,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => _placeholder(colors),
              )
            : _placeholder(colors),
      ),
    );
  }

  Widget _placeholder(ColorScheme colors) {
    return Container(
      color: colors.primaryContainer.withValues(alpha: 0.55),
      child: Icon(
        hasCourses ? Icons.spa_rounded : Icons.account_balance_outlined,
        color: colors.onPrimaryContainer,
      ),
    );
  }
}

Future<void> copyPhone(BuildContext context, String phone) async {
  await Clipboard.setData(ClipboardData(text: phone));
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text('Đã sao chép SĐT: $phone')),
  );
}
