import 'package:flutter_test/flutter_test.dart';

import 'package:tosuthien/features/mp3/models/mp3_track.dart';
import 'package:tosuthien/features/offline_mp3/models/saved_mp3_track.dart';

void main() {
  test('SavedMp3Track round-trip keeps favorite and download flags', () {
    const track = Mp3Track(
      id: 't1',
      title: 'Tham thiền',
      year: 1995,
      publicUrl: 'https://api.tosuthien.net/files/mp3/a.mp3',
      categoryName: 'Pháp thoại',
    );

    final saved = SavedMp3Track.fromTrack(
      track,
      localFileName: 't1.mp3',
      downloadedAt: DateTime.parse('2026-07-08T10:00:00Z'),
      favoritedAt: DateTime.parse('2026-07-08T09:00:00Z'),
    );

    final restored = SavedMp3Track.fromJson(saved.toJson());
    expect(restored.id, 't1');
    expect(restored.isFavorite, isTrue);
    expect(restored.isDownloaded, isTrue);
    expect(restored.localFileName, 't1.mp3');
    expect(restored.toTrack().publicUrl, track.publicUrl);
  });

  test('clearing favorite keeps download metadata', () {
    final saved = SavedMp3Track.fromTrack(
      const Mp3Track(
        id: 't2',
        title: 'X',
        year: 2000,
        publicUrl: 'https://example.com/x.mp3',
      ),
      localFileName: 't2.mp3',
      downloadedAt: DateTime.parse('2026-07-08T10:00:00Z'),
      favoritedAt: DateTime.parse('2026-07-08T09:00:00Z'),
    );

    final next = saved.copyWith(clearFavorite: true);
    expect(next.isFavorite, isFalse);
    expect(next.isDownloaded, isTrue);
  });
}
