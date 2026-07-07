import 'package:flutter_test/flutter_test.dart';

import 'package:tosuthien/features/mp3/models/mp3_folder_listing.dart';
import 'package:tosuthien/features/mp3/models/mp3_track.dart';

void main() {
  group('Mp3FolderListing', () {
    test('fromJson parses folders from files API', () {
      final listing = Mp3FolderListing.fromJson({
        'root': 'mp3',
        'currentPath': 'test/',
        'folders': ['test/sub/'],
        'files': [],
      });

      expect(listing.root, 'mp3');
      expect(listing.currentPath, 'test/');
      expect(listing.folders, ['test/sub/']);
      expect(mp3FolderDisplayName('test/sub/'), 'sub');
    });
  });

  group('Mp3Track', () {
    test('fromJson parses category name', () {
      final track = Mp3Track.fromJson({
        'id': 'abc',
        'title': 'Bài giảng 01',
        'year': 2026,
        'publicUrl': 'http://localhost:8000/files/mp3/a.mp3',
        'category': {'name': 'Pháp thoại'},
      });

      expect(track.title, 'Bài giảng 01');
      expect(track.categoryName, 'Pháp thoại');
      expect(track.year, 2026);
    });
  });
}
