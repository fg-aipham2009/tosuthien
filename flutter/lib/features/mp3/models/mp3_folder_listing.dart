class Mp3FolderListing {
  const Mp3FolderListing({
    required this.root,
    required this.currentPath,
    required this.folders,
  });

  final String root;
  final String currentPath;
  final List<String> folders;

  factory Mp3FolderListing.fromJson(Map<String, dynamic> json) {
    final rawFolders = json['folders'];
    return Mp3FolderListing(
      root: json['root'] as String,
      currentPath: json['currentPath'] as String? ?? '',
      folders: rawFolders is List
          ? rawFolders.whereType<String>().toList()
          : const [],
    );
  }
}

String mp3FolderDisplayName(String folderPath) {
  final trimmed = folderPath.replaceAll(RegExp(r'/+$'), '');
  if (trimmed.isEmpty) return 'Thư mục gốc';
  final parts = trimmed.split('/');
  return parts.last;
}
