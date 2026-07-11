import '../../../core/config/api_config.dart';

enum CenterRegion {
  bac,
  trung,
  nam,
  nuocNgoai,
  unknown;

  static CenterRegion fromCode(String? code) {
    switch ((code ?? '').trim().toUpperCase()) {
      case 'BAC':
        return CenterRegion.bac;
      case 'TRUNG':
        return CenterRegion.trung;
      case 'NAM':
        return CenterRegion.nam;
      case 'NUOC_NGOAI':
        return CenterRegion.nuocNgoai;
      default:
        return CenterRegion.unknown;
    }
  }

  String get label => switch (this) {
        CenterRegion.bac => 'Miền Bắc',
        CenterRegion.trung => 'Miền Trung',
        CenterRegion.nam => 'Miền Nam',
        CenterRegion.nuocNgoai => 'Nước ngoài',
        CenterRegion.unknown => 'Khác',
      };

  int get sortRank => switch (this) {
        // Display order: Nam → Trung → Bắc → Nước ngoài
        CenterRegion.nam => 0,
        CenterRegion.trung => 1,
        CenterRegion.bac => 2,
        CenterRegion.nuocNgoai => 3,
        CenterRegion.unknown => 9,
      };

  String get apiCode => switch (this) {
        CenterRegion.bac => 'BAC',
        CenterRegion.trung => 'TRUNG',
        CenterRegion.nam => 'NAM',
        CenterRegion.nuocNgoai => 'NUOC_NGOAI',
        CenterRegion.unknown => '',
      };
}

class CenterCourse {
  const CenterCourse({
    required this.id,
    required this.title,
    this.type,
    this.recurrence,
    this.startDate,
    this.endDate,
    this.dayStart,
    this.dayEnd,
    this.weekday,
    this.scheduleText,
    this.contact,
    this.description,
    this.sortOrder = 0,
  });

  final String id;
  final String title;
  final String? type;
  final String? recurrence;
  final DateTime? startDate;
  final DateTime? endDate;
  final int? dayStart;
  final int? dayEnd;
  final int? weekday;
  final String? scheduleText;
  final String? contact;
  final String? description;
  final int sortOrder;

  bool get isSpring => type == 'SPRING';
  bool get isWinter => type == 'WINTER';
  bool get isAnCu => type == 'AN_CU';
  bool get isSeasonHighlight => isSpring || isWinter;

  String get typeLabel => switch (type) {
        'SPRING' => 'Khóa mùa xuân',
        'WINTER' => 'Khóa mùa đông',
        'AN_CU' => 'An cư',
        'REGULAR' => 'Khóa tu thiền thất',
        'OTHER' => 'Khóa tu',
        _ => title,
      };

  /// Human-readable schedule for list/detail chips.
  String get scheduleLabel {
    if (scheduleText != null && scheduleText!.trim().isNotEmpty) {
      return scheduleText!.trim();
    }
    if (dayStart != null && dayEnd != null) {
      return 'Ngày $dayStart–$dayEnd hàng tháng';
    }
    if (weekday != null) {
      return '${_weekdayName(weekday!)} hàng tuần';
    }
    if (startDate != null && endDate != null) {
      return '${_fmtDate(startDate!)} – ${_fmtDate(endDate!)}';
    }
    if (startDate != null) return 'Từ ${_fmtDate(startDate!)}';
    return 'Lịch cập nhật sau';
  }

  factory CenterCourse.fromJson(Map<String, dynamic> json) {
    return CenterCourse(
      id: json['id'] as String,
      title: (json['title'] as String?) ?? 'Khóa tu',
      type: json['type'] as String?,
      recurrence: json['recurrence'] as String?,
      startDate: _asDate(json['startDate']),
      endDate: _asDate(json['endDate']),
      dayStart: _asInt(json['dayStart']),
      dayEnd: _asInt(json['dayEnd']),
      weekday: _asInt(json['weekday']),
      scheduleText: json['scheduleText'] as String?,
      contact: json['contact'] as String?,
      description: json['description'] as String?,
      sortOrder: _asInt(json['sortOrder']) ?? 0,
    );
  }

  static String _weekdayName(int day) {
    const names = [
      'Chủ nhật',
      'Thứ hai',
      'Thứ ba',
      'Thứ tư',
      'Thứ năm',
      'Thứ sáu',
      'Thứ bảy',
    ];
    if (day < 0 || day > 6) return 'Hàng tuần';
    return names[day];
  }

  static String _fmtDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}';
}

class MeditationCenter {
  const MeditationCenter({
    required this.id,
    required this.templeName,
    this.slug,
    this.abbotName,
    this.abbotRank,
    this.abbotTitle,
    this.orgRole,
    this.genderSection,
    this.regionCode,
    this.countryCode,
    this.province,
    this.address,
    this.phone,
    this.abbotPhone,
    this.googleMapsUrl,
    this.mainImageUrl,
    this.detailContent,
    this.activityHours,
    this.rules,
    this.customs,
    this.sortOrder = 0,
    this.courses = const [],
  });

  final String id;
  final String templeName;
  final String? slug;
  final String? abbotName;
  final String? abbotRank;
  final String? abbotTitle;
  final String? orgRole;
  final String? genderSection;
  final String? regionCode;
  final String? countryCode;
  final String? province;
  final String? address;
  final String? phone;
  final String? abbotPhone;
  final String? googleMapsUrl;
  final String? mainImageUrl;
  final String? detailContent;
  final String? activityHours;
  final String? rules;
  final String? customs;
  final int sortOrder;
  final List<CenterCourse> courses;

  CenterRegion get region => CenterRegion.fromCode(regionCode);

  bool get hasCourses => courses.isNotEmpty;

  bool get hasSeasonCourse =>
      courses.any((c) => c.isSpring || c.isWinter);

  String get abbotDisplay {
    final parts = <String>[
      if (abbotRank != null && abbotRank!.isNotEmpty) abbotRank!,
      if (abbotName != null && abbotName!.isNotEmpty) abbotName!,
    ];
    return parts.join(' ');
  }

  String? get contactPhone =>
      (phone != null && phone!.isNotEmpty) ? phone : abbotPhone;

  String? get resolvedImageUrl {
    final raw = mainImageUrl;
    if (raw == null || raw.isEmpty) return null;
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    final path = raw.startsWith('/') ? raw.substring(1) : raw;
    if (path.startsWith('files/')) return '${ApiConfig.baseUrl}/$path';
    return '${ApiConfig.baseUrl}/files/$path';
  }

  /// Short line under the temple name on list cards.
  String get subtitleLine {
    final bits = <String>[
      if (abbotDisplay.isNotEmpty) abbotDisplay,
      if (province != null && province!.isNotEmpty) province!,
    ];
    return bits.join(' · ');
  }

  factory MeditationCenter.fromJson(Map<String, dynamic> json) {
    final rawCourses = json['courses'];
    final courses = <CenterCourse>[];
    if (rawCourses is List) {
      for (final row in rawCourses) {
        if (row is Map<String, dynamic>) {
          courses.add(CenterCourse.fromJson(row));
        }
      }
      courses.sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    }

    return MeditationCenter(
      id: json['id'] as String,
      templeName: (json['templeName'] as String?) ?? 'Thiền đường',
      slug: json['slug'] as String?,
      abbotName: json['abbotName'] as String?,
      abbotRank: json['abbotRank'] as String?,
      abbotTitle: json['abbotTitle'] as String?,
      orgRole: json['orgRole'] as String?,
      genderSection: json['genderSection'] as String?,
      regionCode: json['region'] as String?,
      countryCode: json['countryCode'] as String?,
      province: json['province'] as String?,
      address: json['address'] as String?,
      phone: json['phone'] as String?,
      abbotPhone: json['abbotPhone'] as String?,
      googleMapsUrl: json['googleMapsUrl'] as String?,
      mainImageUrl: json['mainImageUrl'] as String?,
      detailContent: json['detailContent'] as String?,
      activityHours: json['activityHours'] as String?,
      rules: json['rules'] as String?,
      customs: json['customs'] as String?,
      sortOrder: _asInt(json['sortOrder']) ?? 0,
      courses: courses,
    );
  }
}

class CenterRegionGroup {
  const CenterRegionGroup({
    required this.region,
    required this.centers,
  });

  final CenterRegion region;
  final List<MeditationCenter> centers;
}

/// Group by region; within each region, places with courses first.
List<CenterRegionGroup> groupCentersByRegion(List<MeditationCenter> centers) {
  final map = <CenterRegion, List<MeditationCenter>>{};
  for (final c in centers) {
    map.putIfAbsent(c.region, () => []).add(c);
  }

  for (final list in map.values) {
    list.sort((a, b) {
      final ac = a.hasCourses ? 0 : 1;
      final bc = b.hasCourses ? 0 : 1;
      if (ac != bc) return ac - bc;
      return a.sortOrder.compareTo(b.sortOrder);
    });
  }

  final order = [
    CenterRegion.nam,
    CenterRegion.trung,
    CenterRegion.bac,
    CenterRegion.nuocNgoai,
    CenterRegion.unknown,
  ];

  return [
    for (final region in order)
      if (map[region]?.isNotEmpty == true)
        CenterRegionGroup(region: region, centers: map[region]!),
  ];
}

DateTime? _asDate(dynamic value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  if (value is String) return DateTime.tryParse(value);
  return null;
}

int? _asInt(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}
