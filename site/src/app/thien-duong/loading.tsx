import { DelayedLoadingBlock } from "../../components/ui/DelayedLoading";

export default function Loading() {
  return (
    <DelayedLoadingBlock
      label="Đang tải danh sách thiền đường…"
      className="mx-auto max-w-[1080px] px-4"
    />
  );
}
