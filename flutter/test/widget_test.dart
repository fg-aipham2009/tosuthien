import 'package:flutter_test/flutter_test.dart';

import 'package:tosuthien/app/app.dart';

void main() {
  testWidgets('shows bottom navigation tabs', (WidgetTester tester) async {
    await tester.pumpWidget(const ToSuThienApp());
    await tester.pumpAndSettle();

    expect(find.text('Hỏi đáp'), findsWidgets);
    expect(find.text('MP3'), findsWidgets);
    expect(find.text('YouTube'), findsWidgets);
    expect(find.text('Kinh sách'), findsWidgets);
    expect(find.text('Thiền đường'), findsWidgets);
  });
}
