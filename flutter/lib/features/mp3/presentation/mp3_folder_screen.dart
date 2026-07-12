import 'package:flutter/material.dart';

import '../../../../core/widgets/empty_state_view.dart';
import '../../../../core/widgets/refreshable_async_body.dart';
import '../audio/mp3_audio_scope.dart';
import '../data/mp3_repository.dart';
import '../models/mp3_folder_listing.dart';
import '../models/mp3_track.dart';
import 'mp3_player_screen.dart';
import '../widgets/mp3_folder_tile.dart';
import '../widgets/mp3_hero_header.dart';
import '../widgets/mp3_section_header.dart';
import '../widgets/mp3_track_list.dart';

class Mp3FolderScreen extends StatefulWidget {
  const Mp3FolderScreen({
    super.key,
    this.folderPath = '',
    this.repository,
  });

  final String folderPath;
  final Mp3Repository? repository;

  @override
  State<Mp3FolderScreen> createState() => _Mp3FolderScreenState();
}

class _Mp3FolderScreenState extends State<Mp3FolderScreen> {
  late final Mp3Repository _repository;
  late Future<Mp3FolderBrowseResult> _future;
  int? _selectedYear;

  bool get _isRoot => widget.folderPath.isEmpty;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? Mp3Repository();
    _future = _load();
  }

  @override
  void dispose() {
    if (widget.repository == null) {
      _repository.dispose();
    }
    super.dispose();
  }

  Future<Mp3FolderBrowseResult> _load() async {
    final listing = await _repository.fetchFolderListing(path: widget.folderPath);
    final tracks = _isRoot
        ? const <Mp3Track>[]
        : await _repository.fetchTracks(folderPath: listing.currentPath);
    return Mp3FolderBrowseResult(listing: listing, tracks: tracks);
  }

  Future<void> _reload() async {
    setState(() => _future = _load());
    await _future;
  }

  void _openFolder(String folderPath) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => Mp3FolderScreen(
          folderPath: folderPath,
          repository: _repository,
        ),
      ),
    );
  }

  Future<void> _onTrackTap(List<Mp3Track> visibleTracks, Mp3Track track) {
    return playMp3AndOpenPlayer(
      context,
      queue: visibleTracks,
      track: track,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    final body = ColoredBox(
      color: colors.surfaceContainerLowest,
      child: RefreshableAsyncBody<Mp3FolderBrowseResult>(
        future: _future,
        onRefresh: _reload,
        builder: (context, data) => _buildContent(context, data),
      ),
    );

    if (_isRoot) return body;

    return Scaffold(
      backgroundColor: colors.surfaceContainerLowest,
      appBar: AppBar(
        title: Text(mp3FolderDisplayName(widget.folderPath)),
        elevation: 0,
        scrolledUnderElevation: 0.5,
        backgroundColor: colors.surfaceContainerLowest,
      ),
      body: body,
    );
  }

  Widget _buildContent(BuildContext context, Mp3FolderBrowseResult data) {
    final folders = data.listing.folders;
    final tracks = data.tracks;
    final years = tracks.map((t) => t.year).toSet().toList()..sort((a, b) => b.compareTo(a));
    final filtered = _selectedYear == null
        ? tracks
        : tracks.where((t) => t.year == _selectedYear).toList();

    final showTracks = !_isRoot;

    if (folders.isEmpty && (!showTracks || tracks.isEmpty)) {
      return EmptyStateView(
        icon: Icons.folder_off_outlined,
        message: _isRoot
            ? 'Chưa có thư mục pháp âm'
            : 'Thư mục trống — chưa có MP3',
      );
    }

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        if (_isRoot)
          const SliverToBoxAdapter(
            child: Mp3HeroHeader(
              title: 'Pháp âm',
              subtitle: 'Chọn thư mục bên dưới để nghe pháp thoại, thiền và tụng kinh.',
            ),
          ),
        if (!_isRoot)
          SliverToBoxAdapter(
            child: Mp3Breadcrumb(folderPath: widget.folderPath),
          ),
        if (folders.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: Mp3SectionHeader(
              title: 'Thư mục',
              icon: Icons.folder_open_rounded,
              trailing: '${folders.length}',
            ),
          ),
          SliverToBoxAdapter(
            child: Mp3GroupedList(
              children: [
                for (var i = 0; i < folders.length; i++)
                  Mp3FolderTile(
                    folderPath: folders[i],
                    showDivider: i < folders.length - 1,
                    onTap: () => _openFolder(folders[i]),
                  ),
              ],
            ),
          ),
        ],
        if (showTracks && tracks.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: Mp3SectionHeader(
              title: 'Danh sách phát',
              icon: Icons.queue_music_rounded,
              trailing: '${tracks.length} bài',
            ),
          ),
          if (years.length > 1)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Lọc theo năm',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                    ),
                    const SizedBox(height: 8),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _YearChip(
                            label: 'Tất cả',
                            selected: _selectedYear == null,
                            onTap: () => setState(() => _selectedYear = null),
                          ),
                          for (final year in years)
                            _YearChip(
                              label: '$year',
                              selected: _selectedYear == year,
                              onTap: () => setState(() => _selectedYear = year),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          SliverToBoxAdapter(
            child: Mp3GroupedList(
              children: [
                ListenableBuilder(
                  listenable: Mp3AudioScope.of(context),
                  builder: (context, _) {
                    final audio = Mp3AudioScope.of(context);
                    return Mp3TrackList(
                      tracks: filtered,
                      shrinkWrap: true,
                      groupByYear: _selectedYear == null && years.length > 1,
                      activeTrackId: audio.currentTrack?.id,
                      isPlaying: audio.isPlaying,
                      onTrackTap: (track) => _onTrackTap(filtered, track),
                    );
                  },
                ),
              ],
            ),
          ),
        ],
        const SliverPadding(padding: EdgeInsets.only(bottom: 24)),
      ],
    );
  }
}

class _YearChip extends StatelessWidget {
  const _YearChip({
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
      child: FilterChip(
        label: Text(label),
        selected: selected,
        showCheckmark: false,
        onSelected: (_) => onTap(),
        selectedColor: colors.primaryContainer,
        labelStyle: TextStyle(
          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          color: selected ? colors.onPrimaryContainer : colors.onSurface,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(
            color: selected ? colors.primary : colors.outlineVariant,
          ),
        ),
      ),
    );
  }
}
