import sys
import tarfile
import shutil
from pathlib import Path

archive, output = sys.argv[1:]
root = Path(output)
root.mkdir(parents=True, exist_ok=True)
with tarfile.open(archive) as package:
    for member in package.getmembers():
        path = Path(member.name)
        if path.is_absolute() or '..' in path.parts or not (member.isfile() or member.isdir()):
            raise ValueError('归档包含不安全的路径或链接')
    # Debian's Python 3.11 lacks extractall(filter=...). Copy only the already
    # validated regular files/directories, and reject duplicate paths as well.
    for member in package.getmembers():
        target = root.joinpath(*Path(member.name).parts)
        if member.isdir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            with package.extractfile(member) as source, target.open('xb') as destination:
                shutil.copyfileobj(source, destination)
