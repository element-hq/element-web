#!/usr/bin/env python3
#
# download and unpack an element-web tarball.
#
# Allows `bundles` to be extracted to a common directory, and a link to
# config.json to be added.

import argparse
import errno
import os
import os.path
import subprocess
import sys
import tarfile
import shutil
from urllib.request import urlretrieve


class DeployException(Exception):
    pass


def create_relative_symlink(linkname, target):
    relpath = os.path.relpath(target, os.path.dirname(linkname))
    print("Symlink %s -> %s" % (linkname, relpath))

    try:
        os.symlink(relpath, linkname)
    except OSError as e:
        if e.errno == errno.EEXIST:
            # atomic modification
            tmp = linkname + ".tmp"
            try:
                os.unlink(tmp)
            except FileNotFoundError:
                pass
            os.symlink(relpath, tmp)
            os.replace(tmp, linkname)
        else:
            raise e


def move_bundles(source, dest):
    """Move the contents of the 'bundles' directory to a common dir

    We check that we will not be overwriting anything before we proceed.

    Args:
        source (str): path to 'bundles' within the extracted tarball
        dest (str): target common directory
    """

    if not os.path.isdir(source):
        print("No bundles directory found at %s; skipping." % (source,))
        return

    if not os.path.isdir(dest):
        os.makedirs(dest, exist_ok=True)

    # build a map from source to destination, checking for non-existence as we go.
    renames = {}
    for f in os.listdir(source):
        dst = os.path.join(dest, f)
        if os.path.exists(dst):
            print(
                "Skipping bundle. The bundle includes '%s' which we have previously deployed."
                % f
            )
        else:
            renames[os.path.join(source, f)] = dst

    for (src, dst) in renames.items():
        print("Move %s -> %s" % (src, dst))
        os.rename(src, dst)

    # try to remove the now-empty source dir
    try:
        os.rmdir(source)
    except OSError:
        # ignore if not empty or cannot remove
        pass


class Deployer:
    def __init__(self):
        self.packages_path = "."
        self.bundles_path = None
        self.should_clean = False
        self.symlink_latest = None
        # filename -> symlink path e.g 'config.localhost.json' => '../localhost/config.json'
        self.symlink_paths = {}
        self.verify_signature = True
        self._last_downloaded = None

    def download_and_verify(self, url):
        """Download a file (and detached asc signature if verify is enabled) to packages_path.

        Returns:
            (str) local path to downloaded file
        """
        if not os.path.isdir(self.packages_path):
            os.makedirs(self.packages_path, exist_ok=True)

        filename = os.path.basename(url)
        local_path = os.path.join(self.packages_path, filename)

        print("Downloading %s -> %s" % (url, local_path))
        urlretrieve(url, local_path)

        if self.verify_signature:
            sig_url = url + ".asc"
            sig_path = local_path + ".asc"
            try:
                print("Downloading signature %s -> %s" % (sig_url, sig_path))
                urlretrieve(sig_url, sig_path)
                gpg = shutil.which("gpg")
                if gpg:
                    print("Verifying signature for %s" % local_path)
                    subprocess.run(
                        [gpg, "--batch", "--quiet", "--verify", sig_path, local_path],
                        check=True,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                    )
                else:
                    print("gpg not found; skipping signature verification for %s" % local_path)
            except Exception as e:
                # Clean up the downloaded files on failure
                try:
                    os.remove(local_path)
                except Exception:
                    pass
                try:
                    os.remove(sig_path)
                except Exception:
                    pass
                raise DeployException("Failed to verify signature: %s" % e)

        self._last_downloaded = local_path
        return local_path

    def _guess_top_dir(self, tar):
        # Try to guess top-level directory inside tarball
        top = set()
        for m in tar.getmembers():
            name = m.name
            if not name or name == ".":
                continue
            head = name.split("/", 1)[0]
            if head and head != ".":
                top.add(head)
            if len(top) > 1:
                break
        if len(top) == 1:
            return list(top)[0]
        return None

    def _strip_tar_extensions(self, name):
        # Remove known tar/compression extensions to get a folder name
        candidates = [
            ".tar.gz", ".tgz",
            ".tar.bz2", ".tbz2",
            ".tar.xz", ".txz",
            ".tar.zst", ".tzst",
            ".tar",
            ".gz", ".bz2", ".xz", ".zst",
        ]
        for ext in candidates:
            if name.endswith(ext):
                return name[: -len(ext)]
        base, _ = os.path.splitext(name)
        return base

    def extract_tarball(self, tarball_path):
        print("Extracting %s into %s" % (tarball_path, self.packages_path))
        with tarfile.open(tarball_path, mode="r:*") as tar:
            top_dir = self._guess_top_dir(tar)
            tar.extractall(self.packages_path)
        if top_dir:
            extracted_dir = os.path.join(self.packages_path, top_dir)
        else:
            # Fall back to name derived from tarball filename
            base = self._strip_tar_extensions(os.path.basename(tarball_path))
            extracted_dir = os.path.join(self.packages_path, base)
        print("Extracted directory: %s" % extracted_dir)
        return extracted_dir

    def _apply_symlinks(self, root_dir):
        for linkname, target in self.symlink_paths.items():
            link_path = os.path.join(root_dir, linkname)
            target_path = os.path.join(root_dir, target)
            # ensure parent dir exists
            os.makedirs(os.path.dirname(link_path), exist_ok=True)
            create_relative_symlink(link_path, target_path)

    def _symlink_latest(self, extracted_dir):
        if not self.symlink_latest:
            return
        latest_link = self.symlink_latest
        os.makedirs(os.path.dirname(latest_link) or ".", exist_ok=True)
        create_relative_symlink(latest_link, extracted_dir)

    def deploy(self, tarball):
        if not tarball:
            print("No tarball specified; nothing to do.")
            return

        if tarball.startswith("http://") or tarball.startswith("https://"):
            local_tarball = self.download_and_verify(tarball)
        else:
            local_tarball = tarball
            if not os.path.isfile(local_tarball):
                raise DeployException("Tarball not found: %s" % local_tarball)

        extracted_dir = self.extract_tarball(local_tarball)

        if self.bundles_path:
            source_bundles = os.path.join(extracted_dir, "bundles")
            move_bundles(source_bundles, self.bundles_path)

        # Apply requested symlinks inside extracted dir
        if self.symlink_paths:
            self._apply_symlinks(extracted_dir)

        # Create/Update "latest" symlink if requested
        if self.symlink_latest:
            self._symlink_latest(extracted_dir)

        if self.should_clean:
            # Remove the tarball and its signature if we downloaded it
            try:
                if self._last_downloaded and os.path.exists(self._last_downloaded):
                    os.remove(self._last_downloaded)
                    asc = self._last_downloaded + ".asc"
                    if os.path.exists(asc):
                        os.remove(asc)
            except Exception:
                pass


def parse_symlink_args(values):
    """
    Parse --symlink options which can be given as:
      linkname:target or linkname=target
    Returns dict mapping linkname -> target
    """
    mapping = {}
    if not values:
        return mapping
    for v in values:
        if ":" in v:
            k, val = v.split(":", 1)
        elif "=" in v:
            k, val = v.split("=", 1)
        else:
            raise argparse.ArgumentTypeError(
                "Invalid --symlink value '%s'. Expected 'linkname:target'." % v
            )
        k = k.strip()
        val = val.strip()
        if not k or not val:
            raise argparse.ArgumentTypeError(
                "Invalid --symlink value '%s'. linkname and target must be non-empty." % v
            )
        mapping[k] = val
    return mapping


def build_arg_parser():
    parser = argparse.ArgumentParser(
        description="Download, verify and unpack an element-web tarball."
    )
    parser.add_argument(
        "--packages",
        dest="packages_path",
        default=".",
        help="Directory to store downloaded packages and extract into.",
    )
    parser.add_argument(
        "--bundles",
        dest="bundles_path",
        help="Common directory to move 'bundles' into from the extracted tarball.",
    )
    parser.add_argument(
        "--symlink",
        dest="symlink",
        action="append",
        default=[],
        help="Create a symlink inside the extracted directory. Format: linkname:target. "
        "May be specified multiple times.",
    )
    parser.add_argument(
        "--symlink-latest",
        dest="symlink_latest",
        help="Create or update a 'latest' symlink pointing to the extracted directory.",
    )
    parser.add_argument(
        "--no-verify",
        dest="verify_signature",
        action="store_false",
        help="Do not verify detached signature (.asc) when downloading from URL.",
    )
    parser.add_argument(
        "--clean",
        dest="clean",
        action="store_true",
        help="Remove downloaded tarball(s) after successful deployment.",
    )
    # Make tarball optional so the script can run without arguments gracefully
    parser.add_argument(
        "tarball",
        nargs="?",
        help="Path or URL to tarball to deploy.",
    )
    return parser


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    d = Deployer()
    d.packages_path = args.packages_path
    d.bundles_path = args.bundles_path
    d.symlink_latest = args.symlink_latest
    d.verify_signature = args.verify_signature
    d.should_clean = args.clean
    d.symlink_paths = parse_symlink_args(args.symlink)

    try:
        d.deploy(args.tarball)
    except DeployException as e:
        print("Error: %s" % e, file=sys.stderr)
        return 1
    except Exception as e:
        print("Unexpected error: %s" % e, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())