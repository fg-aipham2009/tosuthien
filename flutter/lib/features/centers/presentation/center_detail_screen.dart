import 'package:flutter/material.dart';

import '../data/centers_repository.dart';
import '../models/center_models.dart';
import '../widgets/center_widgets.dart';

class CenterDetailScreen extends StatefulWidget {
  const CenterDetailScreen({
    super.key,
    required this.centerId,
    required this.repository,
    this.initial,
  });

  final String centerId;
  final CentersRepository repository;
  final MeditationCenter? initial;

  @override
  State<CenterDetailScreen> createState() => _CenterDetailScreenState();
}

class _CenterDetailScreenState extends State<CenterDetailScreen> {
  late Future<MeditationCenter> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.initial != null
        ? Future.value(widget.initial!)
        : widget.repository.fetchCenter(widget.centerId);
    // Refresh in background for latest courses/images.
    _refreshQuietly();
  }

  Future<void> _refreshQuietly() async {
    try {
      final fresh = await widget.repository.fetchCenter(widget.centerId);
      if (!mounted) return;
      setState(() => _future = Future.value(fresh));
    } catch (_) {
      // Keep initial payload if refresh fails.
    }
  }

  Future<void> _reload() async {
    setState(() {
      _future = widget.repository.fetchCenter(widget.centerId);
    });
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<MeditationCenter>(
      future: _future,
      builder: (context, snapshot) {
        final center = snapshot.data ?? widget.initial;
        if (center == null && snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (center == null) {
          return Scaffold(
            appBar: AppBar(title: const Text('Thiền đường')),
            body: Center(
              child: TextButton(
                onPressed: _reload,
                child: const Text('Không tải được — thử lại'),
              ),
            ),
          );
        }

        final imageUrl = center.resolvedImageUrl;
        final colors = Theme.of(context).colorScheme;

        return Scaffold(
          appBar: AppBar(title: Text(center.templeName)),
          body: RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: AspectRatio(
                    aspectRatio: 16 / 9,
                    child: imageUrl != null
                        ? Image.network(
                            imageUrl,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) =>
                                _imageFallback(colors, center.hasCourses),
                          )
                        : _imageFallback(colors, center.hasCourses),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  center.templeName,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                if (center.abbotDisplay.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    [
                      if (center.abbotTitle != null &&
                          center.abbotTitle!.isNotEmpty)
                        center.abbotTitle!,
                      center.abbotDisplay,
                    ].join(' · '),
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: colors.onSurfaceVariant,
                        ),
                  ),
                ],
                if (center.orgRole != null && center.orgRole!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Chức vụ: ${center.orgRole}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
                const SizedBox(height: 14),
                _InfoRow(
                  icon: Icons.place_outlined,
                  label: 'Địa chỉ',
                  value: [
                    if (center.address != null && center.address!.isNotEmpty)
                      center.address!,
                    if (center.province != null && center.province!.isNotEmpty)
                      center.province!,
                    center.region.label,
                  ].where((e) => e.isNotEmpty).join('\n'),
                ),
                if (center.contactPhone != null) ...[
                  const SizedBox(height: 10),
                  _InfoRow(
                    icon: Icons.phone_outlined,
                    label: 'Điện thoại',
                    value: center.contactPhone!,
                    action: TextButton(
                      onPressed: () =>
                          copyPhone(context, center.contactPhone!),
                      child: const Text('Sao chép'),
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                Text(
                  'Khóa tu',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 8),
                if (center.courses.isEmpty)
                  Text(
                    'Chưa có lịch khóa tu công bố. Vui lòng liên hệ trụ trì.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: colors.onSurfaceVariant,
                        ),
                  )
                else
                  ...center.courses.map((course) {
                    return Card(
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 10),
                      color: course.isSpring
                          ? const Color(0xFFE8F5E9)
                          : course.isWinter
                              ? const Color(0xFFE3F2FD)
                              : colors.surfaceContainerLowest,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                        side: BorderSide(
                          color: course.isSeasonHighlight
                              ? (course.isSpring
                                      ? const Color(0xFF2E7D32)
                                      : const Color(0xFF1565C0))
                                  .withValues(alpha: 0.4)
                              : colors.outlineVariant.withValues(alpha: 0.4),
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  course.title,
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleSmall
                                      ?.copyWith(fontWeight: FontWeight.w700),
                                ),
                                const SizedBox(height: 8),
                                CourseChip(course: course),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Lịch: ${course.scheduleLabel}',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                            if (course.startDate != null ||
                                course.endDate != null) ...[
                              const SizedBox(height: 4),
                              Text(
                                'Ngày tu: ${_range(course)}',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                            ],
                            if (course.description != null &&
                                course.description!.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(course.description!),
                            ],
                          ],
                        ),
                      ),
                    );
                  }),
                if (center.activityHours != null &&
                    center.activityHours!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  _Section(
                    title: 'Giờ sinh hoạt',
                    body: center.activityHours!,
                  ),
                ],
                if (center.detailContent != null &&
                    center.detailContent!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  _Section(
                    title: 'Giới thiệu',
                    body: center.detailContent!,
                  ),
                ],
                if (center.rules != null && center.rules!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  _Section(title: 'Nội quy', body: center.rules!),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  static String _range(CenterCourse course) {
    String fmt(DateTime d) =>
        '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
    if (course.startDate != null && course.endDate != null) {
      return '${fmt(course.startDate!)} – ${fmt(course.endDate!)}';
    }
    if (course.startDate != null) return 'Từ ${fmt(course.startDate!)}';
    if (course.endDate != null) return 'Đến ${fmt(course.endDate!)}';
    return '';
  }

  Widget _imageFallback(ColorScheme colors, bool hasCourses) {
    return Container(
      color: colors.primaryContainer.withValues(alpha: 0.5),
      child: Icon(
        hasCourses ? Icons.spa_rounded : Icons.account_balance_outlined,
        size: 48,
        color: colors.onPrimaryContainer,
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.action,
  });

  final IconData icon;
  final String label;
  final String value;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: 2),
              SelectableText(value),
            ],
          ),
        ),
        if (action != null) action!,
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
        ),
        const SizedBox(height: 6),
        Text(body, style: const TextStyle(height: 1.45)),
      ],
    );
  }
}
