import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';

test('backup extraction accepts ordinary files and rejects traversal, links and duplicate paths', () => {
  const verification = spawnSync('python3', ['-c', String.raw`
import io, subprocess, tarfile, tempfile
from pathlib import Path
with tempfile.TemporaryDirectory(prefix='journal-archive-') as directory:
    root = Path(directory)
    cases = [('media/photo.webp', None, True), ('../escaped', None, False),
             (str(root / 'escaped'), None, False), ('link', tarfile.SYMTYPE, False),
             ('hardlink', tarfile.LNKTYPE, False), ('duplicate', None, False)]
    for index, (name, kind, accepted) in enumerate(cases):
        archive = root / (str(index) + '.tar')
        with tarfile.open(archive, 'w') as package:
            member = tarfile.TarInfo(name)
            if kind:
                member.type, member.linkname = kind, '../escaped'
                package.addfile(member)
            else:
                member.size = 5
                package.addfile(member, io.BytesIO(b'photo'))
                if name == 'duplicate':
                    package.addfile(member, io.BytesIO(b'photo'))
        output = root / ('output-' + str(index))
        result = subprocess.run(['python3', 'ops/safe-extract.py', str(archive), str(output)], capture_output=True)
        assert (result.returncode == 0) == accepted, result.stderr.decode()
        if accepted:
            assert (output / name).read_bytes() == b'photo'
    assert not (root / 'escaped').exists()
`], { encoding: 'utf8' });
  expect(verification.status, verification.stderr).toBe(0);
}, 15000);
