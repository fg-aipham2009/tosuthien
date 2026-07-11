import 'package:flutter/material.dart';

import '../../../app/theme.dart';
import '../../../core/widgets/empty_state_view.dart';
import '../../../core/widgets/refreshable_async_body.dart';
import '../data/centers_repository.dart';
import '../models/center_models.dart';
import '../widgets/center_widgets.dart';
import 'center_detail_screen.dart';

class CentersScreen extends StatefulWidget {
  const CentersScreen({super.key});

  @override
  State<CentersScreen> createState() => _CentersScreenState();
}

class _CentersScreenState extends State<CentersScreen> {
  late final CentersRepository _repository;
  late Future<List<MeditationCenter>> _future;
  CenterRegion? _filter;

  @override
  void initState() {
    super.initState();
    _repository = CentersRepository();
    _future = _repository.fetchCenters();
  }

  @override
  void dispose() {
    _repository.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    setState(() => _future = _repository.fetchCenters());
    await _future;
  }

  void _openDetail(MeditationCenter center) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => CenterDetailScreen(
          centerId: center.id,
          initial: center,
          repository: _repository,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return RefreshableAsyncBody<List<MeditationCenter>>(
      future: _future,
      onRefresh: _reload,
      builder: (context, centers) {
        if (centers.isEmpty) {
          return const EmptyStateView(
            icon: Icons.spa_outlined,
            message: 'Chưa có thiền đường.\nVui lòng thử lại sau.',
          );
        }

        final filtered = _filter == null
            ? centers
            : centers.where((c) => c.region == _filter).toList();
        final groups = groupCentersByRegion(filtered);
        final withCourses = centers.where((c) => c.hasCourses).length;

        return CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  gradient: AppTheme.mp3HeaderGradient,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Thiền đường',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Nhóm theo vùng — ưu tiên nơi đang có khóa tu để Phật tử dễ tham dự.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.white.withValues(alpha: 0.9),
                            height: 1.4,
                          ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      '$withCourses / ${centers.length} nơi có lịch khóa tu',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 44,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  children: [
                    _FilterChip(
                      label: 'Tất cả',
                      selected: _filter == null,
                      onTap: () => setState(() => _filter = null),
                    ),
                    for (final region in [
                      CenterRegion.bac,
                      CenterRegion.trung,
                      CenterRegion.nam,
                      CenterRegion.nuocNgoai,
                    ])
                      _FilterChip(
                        label: region.label,
                        selected: _filter == region,
                        onTap: () => setState(() => _filter = region),
                      ),
                  ],
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 8)),
            if (groups.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: EmptyStateView(
                  icon: Icons.filter_alt_off_outlined,
                  message: 'Không có thiền đường trong vùng này.',
                ),
              )
            else
              for (final group in groups) ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                    child: Row(
                      children: [
                        Text(
                          group.region.label,
                          style:
                              Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w800,
                                  ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${group.centers.length}',
                          style:
                              Theme.of(context).textTheme.labelMedium?.copyWith(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .onSurfaceVariant,
                                  ),
                        ),
                      ],
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  sliver: SliverList.builder(
                    itemCount: group.centers.length,
                    itemBuilder: (context, index) {
                      final center = group.centers[index];
                      return CenterListTile(
                        center: center,
                        onTap: () => _openDetail(center),
                      );
                    },
                  ),
                ),
              ],
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        );
      },
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onTap(),
        selectedColor: colors.primary.withValues(alpha: 0.18),
        labelStyle: TextStyle(
          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          color: selected ? colors.primary : colors.onSurface,
        ),
      ),
    );
  }
}
