#!/usr/bin/env python3
"""
Batch denoise speech MP3/WAV folders with DeepFilterNet.

Designed for LARGE libraries:
  - Recursive scan
  - Resume (skip files already in output / listed in progress log)
  - Manifest JSONL for audit
  - Never overwrites source files
  - Optional --limit for smoke tests

Prereqs (Mac):
  brew install ffmpeg
  python3 -m venv .venv-denoise && source .venv-denoise/bin/activate
  pip install deepfilternet torch torchaudio soundfile tqdm

Example:
  python3 scripts/denoise_mp3_folder.py \\
    --input data/mp3 \\
    --output data/mp3_clean \\
    --workers 1

  # Smoke test first 3 files:
  python3 scripts/denoise_mp3_folder.py -i data/mp3 -o data/mp3_clean --limit 3

  # Resume after crash (same -i/-o):
  python3 scripts/denoise_mp3_folder.py -i data/mp3 -o data/mp3_clean
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path


AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def require_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        print(
            "ERROR: ffmpeg/ffprobe not found.\n"
            "  Mac:  brew install ffmpeg\n"
            "  Ubuntu: sudo apt install ffmpeg",
            file=sys.stderr,
        )
        sys.exit(1)


def list_audio_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in AUDIO_EXTS:
            files.append(p)
    return sorted(files)


def load_done(progress_path: Path) -> set[str]:
    done: set[str] = set()
    if not progress_path.exists():
        return done
    with progress_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row.get("status") == "ok" and row.get("rel"):
                done.add(row["rel"])
    return done


def append_progress(progress_path: Path, row: dict) -> None:
    progress_path.parent.mkdir(parents=True, exist_ok=True)
    with progress_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def to_wav_48k_mono(src: Path, wav_out: Path) -> None:
    wav_out.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(src),
        "-ac",
        "1",
        "-ar",
        "48000",
        "-c:a",
        "pcm_s16le",
        str(wav_out),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def wav_to_mp3(wav_in: Path, mp3_out: Path, bitrate: str = "192k") -> None:
    mp3_out.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(wav_in),
        "-codec:a",
        "libmp3lame",
        "-b:a",
        bitrate,
        str(mp3_out),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def process_one(
    src: Path,
    dst: Path,
    *,
    model,
    df_state,
    enhance_fn,
    load_audio_fn,
    save_audio_fn,
    use_pf: bool,
    keep_wav: bool,
) -> dict:
    t0 = time.time()
    with tempfile.TemporaryDirectory(prefix="denoise_") as tmp:
        tmp_dir = Path(tmp)
        in_wav = tmp_dir / "in.wav"
        out_wav = tmp_dir / "out.wav"

        to_wav_48k_mono(src, in_wav)
        audio, _ = load_audio_fn(str(in_wav), sr=df_state.sr())
        enhanced = enhance_fn(model, df_state, audio, pad=True, atten_lim_db=None)
        # DeepFilterNet API: enhance(..., pad=True); pf is model init flag in some versions
        save_audio_fn(str(out_wav), enhanced, df_state.sr())

        if dst.suffix.lower() == ".mp3" or src.suffix.lower() == ".mp3":
            final = dst.with_suffix(".mp3")
            wav_to_mp3(out_wav, final)
        else:
            final = dst.with_suffix(".wav")
            shutil.copy2(out_wav, final)

        if keep_wav:
            wav_keep = final.with_suffix(".wav")
            shutil.copy2(out_wav, wav_keep)

    return {
        "seconds": round(time.time() - t0, 2),
        "out": str(final),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch DeepFilterNet denoise for large MP3 folders")
    parser.add_argument("--input", "-i", type=Path, required=True, help="Source folder (recursive)")
    parser.add_argument("--output", "-o", type=Path, required=True, help="Output folder (mirrors structure)")
    parser.add_argument("--limit", type=int, default=0, help="Process only N files (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="List files only")
    parser.add_argument("--force", action="store_true", help="Re-process even if already done")
    parser.add_argument("--pf", action="store_true", help="Stronger post-filter (more noise cut)")
    parser.add_argument("--keep-wav", action="store_true", help="Also keep 48k WAV alongside MP3")
    parser.add_argument(
        "--model",
        default="DeepFilterNet2",
        help="Model name: DeepFilterNet | DeepFilterNet2 | DeepFilterNet3",
    )
    args = parser.parse_args()

    src_root = args.input.resolve()
    out_root = args.output.resolve()
    if not src_root.is_dir():
        print(f"ERROR: input not found: {src_root}", file=sys.stderr)
        return 1

    require_ffmpeg()

    files = list_audio_files(src_root)
    print(f"Found {len(files)} audio files under {src_root}")

    progress_path = out_root / "_denoise_progress.jsonl"
    done = set() if args.force else load_done(progress_path)
    print(f"Already done (resume): {len(done)}")

    todo: list[tuple[Path, Path, str]] = []
    for src in files:
        rel = str(src.relative_to(src_root))
        dst = out_root / rel
        if not args.force and (rel in done or dst.with_suffix(".mp3").exists() or dst.exists()):
            continue
        todo.append((src, dst, rel))

    if args.limit > 0:
        todo = todo[: args.limit]

    print(f"To process: {len(todo)}")
    if args.dry_run:
        for _, _, rel in todo[:50]:
            print(f"  {rel}")
        if len(todo) > 50:
            print(f"  ... +{len(todo) - 50} more")
        return 0

    if not todo:
        print("Nothing to do.")
        return 0

    try:
        from df.enhance import enhance, init_df, load_audio, save_audio
    except ImportError:
        print(
            "ERROR: deepfilternet not installed.\n"
            "  python3 -m venv .venv-denoise && source .venv-denoise/bin/activate\n"
            "  pip install deepfilternet torch torchaudio soundfile tqdm",
            file=sys.stderr,
        )
        return 1

    print(f"Loading model {args.model} ...")
    # post_filter enabled via init_df config when supported
    try:
        model, df_state, _ = init_df(model_base_dir=args.model, post_filter=args.pf)
    except TypeError:
        model, df_state, _ = init_df(model_base_dir=args.model)

    try:
        from tqdm import tqdm
    except ImportError:
        tqdm = None  # type: ignore

    iterator = tqdm(todo, desc="denoise", unit="file") if tqdm else todo
    ok = 0
    fail = 0

    for src, dst, rel in iterator:
        try:
            result = process_one(
                src,
                dst,
                model=model,
                df_state=df_state,
                enhance_fn=enhance,
                load_audio_fn=load_audio,
                save_audio_fn=save_audio,
                use_pf=args.pf,
                keep_wav=args.keep_wav,
            )
            append_progress(
                progress_path,
                {
                    "ts": utc_now(),
                    "status": "ok",
                    "rel": rel,
                    "src": str(src),
                    "out": result["out"],
                    "seconds": result["seconds"],
                },
            )
            ok += 1
        except Exception as e:  # noqa: BLE001 — batch must continue
            fail += 1
            append_progress(
                progress_path,
                {
                    "ts": utc_now(),
                    "status": "error",
                    "rel": rel,
                    "src": str(src),
                    "error": str(e),
                },
            )
            print(f"FAIL {rel}: {e}", file=sys.stderr)

    print(f"Done. ok={ok} fail={fail} progress={progress_path}")
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
