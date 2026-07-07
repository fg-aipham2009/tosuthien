import 'package:flutter/material.dart';

import 'error_state_view.dart';
import 'loading_view.dart';

typedef AsyncBodyBuilder<T> = Widget Function(BuildContext context, T data);

class RefreshableAsyncBody<T> extends StatelessWidget {
  const RefreshableAsyncBody({
    super.key,
    required this.future,
    required this.onRefresh,
    required this.builder,
    this.loading,
  });

  final Future<T> future;
  final Future<void> Function() onRefresh;
  final AsyncBodyBuilder<T> builder;
  final Widget? loading;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: FutureBuilder<T>(
        future: future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return loading ?? const LoadingView();
          }

          if (snapshot.hasError) {
            return ErrorStateView(
              message: snapshot.error.toString(),
              onRetry: () => onRefresh(),
            );
          }

          return builder(context, snapshot.data as T);
        },
      ),
    );
  }
}
