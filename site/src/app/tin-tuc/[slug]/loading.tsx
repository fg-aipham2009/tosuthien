import { DelayedLoadingBlock } from "../../../components/ui/DelayedLoading";

export default function Loading() {
  return (
    <DelayedLoadingBlock
      label="Đang tải bài viết…"
      className="mx-auto max-w-[1080px] px-[15px]"
    />
  );
}
