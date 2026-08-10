import { DelayedLoadingBlock } from "../../components/ui/DelayedLoading";

export default function Loading() {
  return (
    <DelayedLoadingBlock
      label="Đang tải tin tức…"
      className="mx-auto max-w-[1080px] px-[15px]"
    />
  );
}
