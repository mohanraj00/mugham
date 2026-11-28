#!/usr/bin/env python3
"""Build the kit package and the conformance set as byte-identical tar archives.

See docs/decisions/0001-build-tools.md and docs/decisions/0008-stable-contract.md, section 3.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import shutil
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]
INPUTS = ['LICENSE', 'catalog', 'src']
PREFIX = 'mugham'
ARCHIVE = 'mugham.tar'
# The conformance set is a second archive. The kit archive does not contain it (decision 0004).
SET_INPUTS = ['conformance']
SET_ARCHIVE = 'mugham-conformance-%s.tar'
SET_MANIFEST = re.compile(r'conformance/v[1-9][0-9]{0,3}/manifest\.json')
RELEASE = re.compile(r'(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})')


def tracked_files(root, inputs=INPUTS):
    """Return the paths that Git tracks under the inputs, in sorted order."""
    # Git writes its errors to stderr, so a failure stays visible.
    result = subprocess.run(['git', '-C', str(root), 'ls-files', '-z', '--', *inputs], check=True,
                            stdout=subprocess.PIPE)
    names = sorted({name.decode('utf-8') for name in result.stdout.split(b'\0') if name})
    for name in names:
        path = root / name
        if not path.exists() and not path.is_symlink():
            raise SystemExit('build: the file is not on the disk: ' + name)
        if path.is_symlink() or not path.is_file():
            raise SystemExit('build: not a regular file: ' + name)
    return names


def member(name, data, epoch):
    info = tarfile.TarInfo(name)
    info.size = len(data)
    info.mtime = epoch
    info.mode = 0o644
    info.uid = info.gid = 0
    info.uname = info.gname = ''
    return info


def build(root, out, epoch):
    """Write out/mugham.tar from the tracked inputs of root and return its path."""
    out = Path(out)
    if out.exists() and (not out.is_dir() or any(out.iterdir())):
        raise SystemExit('build: the output is not an empty directory: %s' % out)
    out.mkdir(parents=True, exist_ok=True)
    files = {name: (root / name).read_bytes() for name in tracked_files(root)}
    manifest = {'format': 1, 'files': {name: hashlib.sha256(data).hexdigest() for name, data in files.items()}}
    files['manifest.json'] = (json.dumps(manifest, indent=2, sort_keys=True) + '\n').encode('utf-8')
    archive = out / ARCHIVE
    archive.write_bytes(tar_bytes({PREFIX + '/' + name: data for name, data in files.items()}, epoch))
    return archive


def tar_bytes(files, epoch):
    """Return the bytes of a tar archive of the files, in sorted order and with fixed metadata."""
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode='w', format=tarfile.PAX_FORMAT) as tar:
        for name in sorted(files):
            tar.addfile(member(name, files[name], epoch), io.BytesIO(files[name]))
    return buffer.getvalue()


def conformance_set(root):
    """Return the kit release of the conformance set and its tracked files. Stop if a manifest is not current."""
    names = tracked_files(root, SET_INPUTS)
    files = {name: (root / name).read_bytes() for name in names}
    manifests = [name for name in names if SET_MANIFEST.fullmatch(name)]
    if not manifests:
        raise SystemExit('build: the conformance set has no manifest')
    releases = set()
    for name in manifests:
        folder = name[:-len('manifest.json')]
        try:
            manifest = json.loads(files[name].decode('utf-8'))
        except ValueError:
            raise SystemExit('build: the manifest is not JSON: ' + name)
        found = {other[len(folder):]: hashlib.sha256(data).hexdigest()
                 for other, data in files.items() if other.startswith(folder) and other != name}
        if not isinstance(manifest, dict) or manifest.get('files') != found:
            raise SystemExit('build: the manifest does not agree with the tracked files of its set: ' + name)
        releases.add(manifest.get('kit'))
    release = releases.pop()
    if releases or not isinstance(release, str) or not RELEASE.fullmatch(release):
        raise SystemExit('build: the manifests of the conformance set do not give one kit release')
    return release, files


def build_set(root, out, epoch):
    """Write the archive of the conformance set into out and return its path. The name has the kit release."""
    release, files = conformance_set(root)
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    archive = out / (SET_ARCHIVE % release)
    archive.write_bytes(tar_bytes(files, epoch))
    return archive


def build_all(root, out, epoch):
    """Write the kit archive and the archive of the conformance set into the empty directory out."""
    return [build(root, out, epoch), build_set(root, out, epoch)]


def check(root, epoch, stream=sys.stdout):
    """Build two times into two empty directories and compare the bytes of each archive."""
    work = Path(tempfile.mkdtemp(prefix='mugham-build-'))
    builds = [build_all(root, work / name, epoch) for name in ('one', 'two')]
    digests = [[hashlib.sha256(archive.read_bytes()).hexdigest() for archive in archives] for archives in builds]
    same = digests[0] == digests[1]
    # If the bytes differ, keep the archives, so that a person can compare them.
    if same:
        shutil.rmtree(work)
    print(json.dumps({'passed': same, 'archives': [archive.name for archive in builds[0]],
                      'sha256': [pair[0] for pair in digests], 'conformance_sha256': [pair[1] for pair in digests],
                      'source_date_epoch': epoch,
                      'kept': [] if same else [str(archive) for archives in builds for archive in archives],
                      'scope': 'Two local builds of the tracked inputs. No comparison with a build on a different'
                               ' machine.'},
                     indent=2), file=stream)
    return 0 if same else 1


def source_date_epoch(root):
    if 'SOURCE_DATE_EPOCH' in os.environ:
        value = os.environ['SOURCE_DATE_EPOCH'].strip()
        if not value.isascii() or not value.isdigit():
            raise SystemExit('build: SOURCE_DATE_EPOCH must be a number of seconds')
        return int(value)
    # A repository with no commit has no commit time. Then the time is 0. Each other Git error stops the build.
    head = subprocess.run(['git', '-C', str(root), 'rev-parse', '--verify', '-q', 'HEAD'],
                          stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    if head.returncode == 1 and not head.stderr:
        return 0
    if head.returncode != 0:
        raise SystemExit('build: git cannot read HEAD: ' + head.stderr.strip())
    result = subprocess.run(['git', '-C', str(root), 'log', '-1', '--format=%ct'], check=True,
                            stdout=subprocess.PIPE, text=True)
    return int(result.stdout.strip())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', help='an empty output directory')
    parser.add_argument('--check', action='store_true', help='build two times and compare the bytes')
    args = parser.parse_args()
    if args.check and args.out:
        parser.error('give --out or --check, not the two')
    epoch = source_date_epoch(ROOT)
    if args.check:
        return check(ROOT, epoch)
    if not args.out:
        parser.error('give --out or --check')
    for archive in build_all(ROOT, args.out, epoch):
        print(archive)
    return 0


if __name__ == '__main__':
    sys.exit(main())
