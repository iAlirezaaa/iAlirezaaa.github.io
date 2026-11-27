"""Preserve reviewed stationery downloads byte-for-byte during routine builds."""
from hashlib import sha1
from pathlib import Path
from shutil import copyfile
from zipfile import ZipFile

RELEASES = {
    'business-card': ('HADES_Business_Card_Working_Files_REVIEW.zip', 'a3ae0817547591e45c1464881b764daba3bcc396'),
    'letterhead': ('HADES_Letterhead_Working_Files_REVIEW.zip', '3ca4ecb44030d954850c2ac213e1bfd87dcfce88'),
}

def git_blob(data):
    return sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()

def restore(src, out, name, pin):
    src, out = Path(src), Path(out)
    archive = src / name
    data = archive.read_bytes()
    if git_blob(data) != pin:
        raise ValueError('Review ZIP pin changed: ' + name)
    with ZipFile(archive) as z:
        members = z.namelist()
        if len(members) != 12 or len(set(members)) != 12 or z.testzip() is not None:
            raise ValueError('Invalid review ZIP membership or CRC')
        for member in members:
            if Path(member).name != member or member.startswith('.') or '\\' in member or member == name:
                raise ValueError('Unexpected archive member: ' + member)
            if (src / member).read_bytes() != z.read(member):
                raise ValueError('Review source changed; explicit release required: ' + member)
    out.mkdir(parents=True, exist_ok=True)
    for member in [*members, name]:
        copyfile(src / member, out / member)
    print('HADES REVIEW preserved:', name, pin)

def preserve_release(src, out, category):
    restore(src, out, *RELEASES[category])
