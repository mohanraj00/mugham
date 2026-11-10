#!/usr/bin/env python3
"""Build the kit package as a byte-identical tar archive. See docs/decisions/0001-build-tools.md."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]
INPUTS = ['LICENSE', 'catalog', 'src']
PREFIX = 'mugham'
ARCHIVE = 'mugham.tar'


def tracked_files(root):
    """Return the paths that Git tracks under INPUTS, in sorted order."""
    result = subprocess.run(['git', '-C', str(root), 'ls-files', '-z', '--', *INPUTS],
                            check=True, capture_output=True)
    names = sorted({name.decode('utf-8') for name in result.stdout.split(b'\0') if name})
    for name in names:
        path = root / name
        if path.is_symlink() or not path.is_file():
            raise SystemExit('build: not a regular file: ' + name)
    return names


def member(name, data, epoch):
    info = tarfile.TarInfo(PREFIX + '/' + name)
    info.size = len(data)
    info.mtime = epoch
    info.mode = 0o644
    info.uid = info.gid = 0
    info.uname = info.gname = ''
    return info


def build(root, out, epoch):
    """Write out/mugham.tar from the tracked inputs of root and return its path."""
    out = Path(out)
    if out.exists() and any(out.iterdir()):
        raise SystemExit('build: the output directory is not empty: %s' % out)
    out.mkdir(parents=True, exist_ok=True)
    files = {name: (root / name).read_bytes() for name in tracked_files(root)}
    manifest = {'format': 1, 'files': {name: hashlib.sha256(data).hexdigest() for name, data in files.items()}}
    files['manifest.json'] = (json.dumps(manifest, indent=2, sort_keys=True) + '\n').encode('utf-8')
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode='w', format=tarfile.PAX_FORMAT) as tar:
        for name in sorted(files):
            tar.addfile(member(name, files[name], epoch), io.BytesIO(files[name]))
    archive = out / ARCHIVE
    archive.write_bytes(buffer.getvalue())
    return archive


def check(root, epoch, stream=sys.stdout):
    """Build two times into two empty directories and compare the bytes."""
    with tempfile.TemporaryDirectory() as work:
        digests = [hashlib.sha256(build(root, Path(work) / name, epoch).read_bytes()).hexdigest()
                   for name in ('one', 'two')]
    same = digests[0] == digests[1]
    print(json.dumps({'passed': same, 'sha256': digests, 'source_date_epoch': epoch,
                      'scope': 'Two local builds of the tracked inputs. No comparison with a build on a different machine.'},
                     indent=2), file=stream)
    return 0 if same else 1


def source_date_epoch(root):
    if 'SOURCE_DATE_EPOCH' in os.environ:
        return int(os.environ['SOURCE_DATE_EPOCH'])
    result = subprocess.run(['git', '-C', str(root), 'log', '-1', '--format=%ct'], check=True, capture_output=True, text=True)
    return int(result.stdout.strip() or 0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', help='an empty output directory')
    parser.add_argument('--check', action='store_true', help='build two times and compare the bytes')
    args = parser.parse_args()
    epoch = source_date_epoch(ROOT)
    if args.check:
        return check(ROOT, epoch)
    if not args.out:
        parser.error('give --out or --check')
    print(build(ROOT, args.out, epoch))
    return 0


if __name__ == '__main__':
    sys.exit(main())
