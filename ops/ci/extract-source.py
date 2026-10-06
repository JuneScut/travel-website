"""Extract a bounded Git archive, without credentials or persistent data."""
import shutil
import sys
import tarfile
from pathlib import Path

archive, destination, revision = sys.argv[1:]
root = Path(destination)
root.mkdir(parents=True, exist_ok=True)
reserved = {'.git', '.data', '.agents', '.aws', '.codex', '.worktrees', 'node_modules',
            'generated', '.next', '.next-dev', 'dist', 'postgres', 'media', 'runtime', 'backups', 'uploads'}
examples = {'.env.example', '.env.production.example', '.env.production.vps.example'}
with tarfile.open(archive, mode='r:gz') as package:
    if package.pax_headers.get('comment') != revision:
        raise ValueError('Git archive does not match the requested commit')
    members = package.getmembers()
    if len(members) > 10000 or sum(member.size for member in members) > 128 * 1024 * 1024:
        raise ValueError('Source archive exceeds the deployment size limit')
    seen = set()
    for member in members:
        path = Path(member.name)
        if path.is_absolute() or '..' in path.parts or not path.parts:
            raise ValueError('Unsafe source path')
        if not (member.isfile() or member.isdir()) or path.as_posix() in seen:
            raise ValueError('Links, special files and duplicate paths are forbidden')
        seen.add(path.as_posix())
        if path.parts[0] in reserved:
            raise ValueError('Source includes a reserved data directory')
        if any(part.startswith('.env') for part in path.parts) and path.as_posix() not in examples:
            raise ValueError('Source includes an environment credential file')
        if path.suffix in {'.pem', '.key'}:
            raise ValueError('Source includes a private key or certificate')
    for member in members:
        target = root / member.name
        if member.isdir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            with package.extractfile(member) as source, target.open('xb') as output:
                shutil.copyfileobj(source, output)
            target.chmod(0o755 if member.mode & 0o111 else 0o644)
