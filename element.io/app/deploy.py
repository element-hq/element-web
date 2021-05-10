#!/usr/bin/env python
#
# download and unpack a element-web tarball.
#
# Allows `bundles` to be extracted to a common directory, and a link to
# config.json to be added.

from __future__ import print_function

import argparse
import os
import os.path
import subprocess
import sys
import tarfile
import shutil
import glob

try:
    # python3
    from urllib.request import urlretrieve
except ImportError:
    # python2
    from urllib import urlretrieve

class DeployException(Exception):
    pass

def create_relative_symlink(linkname, target):
    relpath = os.path.relpath(target, os.path.dirname(linkname))
    print ("Symlink %s -> %s" % (linkname, relpath))
    os.symlink(relpath, linkname)


def move_bundles(source, dest):
    """Move the contents of the 'bundles' directory to a common dir

    We check that we will not be overwriting anything before we proceed.

    Args:
        source (str): path to 'bundles' within the extracted tarball
        dest (str): target common directory
    """

    if not os.path.isdir(dest):
        os.mkdir(dest)

    # build a map from source to destination, checking for non-existence as we go.
    renames = {}
    for f in os.listdir(source):
        dst = os.path.join(dest, f)
        if os.path.exists(dst):
            print (
                "Skipping bundle. The bundle includes '%s' which we have previously deployed."
                % f
            )
        else:
            renames[os.path.join(source, f)] = dst

    for (src, dst) in renames.iteritems():
        print ("Move %s -> %s" % (src, dst))
        os.rename(src, dst)

class Deployer:
    def __init__(self):
        self.packages_path = "."
        self.bundles_path = None
        self.should_clean = False
        # filename -> symlink path e.g 'config.localhost.json' => '../localhost/config.json'
        self.symlink_paths = {}
        self.verify_signature = True

    def deploy(self, tarball, extract_path):
        """Download a tarball if necessary, and unpack it

        Returns:
            (str) the path to the unpacked deployment
        """
        print("Deploying %s to %s" % (tarball, extract_path))

        name_str = os.path.basename(tarball).replace(".tar.gz", "")
        extracted_dir = os.path.join(extract_path, name_str)
        if os.path.exists(extracted_dir):
            raise DeployException('Cannot unpack %s: %s already exists' % (
                tarball, extracted_dir))

        downloaded = False
        if tarball.startswith("http://") or tarball.startswith("https://"):
            tarball = self.download_and_verify(tarball)
            print("Downloaded file: %s" % tarball)
            downloaded = True

        try:
            with tarfile.open(tarball) as tar:
                tar.extractall(extract_path)
        finally:
            if self.should_clean and downloaded:
                os.remove(tarball)

        print ("Extracted into: %s" % extracted_dir)

        if self.symlink_paths:
            for link_path, file_path in self.symlink_paths.iteritems():
                create_relative_symlink(
                    target=file_path,
                    linkname=os.path.join(extracted_dir, link_path)
                )

        if self.bundles_path:
            extracted_bundles = os.path.join(extracted_dir, 'bundles')
            move_bundles(source=extracted_bundles, dest=self.bundles_path)

            # replace the extracted_bundles dir (which may not be empty if some
            # bundles were skipped) with a symlink to the common dir.
            shutil.rmtree(extracted_bundles)
            create_relative_symlink(
                target=self.bundles_path,
                linkname=extracted_bundles,
            )
        return extracted_dir

    def download_and_verify(self, url):
        tarball = self.download_file(url)

        if self.verify_signature:
            sigfile = self.download_file(url + ".asc")
            subprocess.check_call(["gpg", "--verify", sigfile, tarball])

        return tarball

    def download_file(self, url):
        if not os.path.isdir(self.packages_path):
            os.mkdir(self.packages_path)
        local_filename = os.path.join(self.packages_path,
                                      url.split('/')[-1])
        sys.stdout.write("Downloading %s -> %s..." % (url, local_filename))
        sys.stdout.flush()
        urlretrieve(url, local_filename)
        print ("Done")
        return local_filename

if __name__ == "__main__":
    parser = argparse.ArgumentParser("Deploy a Riot build on a web server.")
    parser.add_argument(
        "-p", "--packages-dir", default="./packages", help=(
            "The directory to download the tarball into. (Default: '%(default)s')"
        )
    )
    parser.add_argument(
        "-e", "--extract-path", default="./deploys", help=(
            "The location to extract .tar.gz files to. (Default: '%(default)s')"
        )
    )
    parser.add_argument(
        "-b", "--bundles-dir", nargs='?', default="./bundles", help=(
            "A directory to move the contents of the 'bundles' directory to. A \
            symlink to the bundles directory will also be written inside the \
            extracted tarball. Example: './bundles'. \
            (Default: '%(default)s')"
        )
    )
    parser.add_argument(
        "-c", "--clean", action="store_true", default=False, help=(
            "Remove .tar.gz files after they have been downloaded and extracted. \
            (Default: %(default)s)"
        )
    )
    parser.add_argument(
        "--include", nargs='*', default=['./config*.json'], help=(
            "Symlink these files into the root of the deployed tarball. \
             Useful for config files and home pages. Supports glob syntax. \
             (Default: '%(default)s')"
        )
    )
    parser.add_argument(
        "tarball", help=(
            "filename of tarball, or URL to download."
        ),
    )

    args = parser.parse_args()

    deployer = Deployer()
    deployer.packages_path = args.packages_dir
    deployer.bundles_path = args.bundles_dir
    deployer.should_clean = args.clean

    for include in args.include:
        deployer.symlink_paths.update({ os.path.basename(pth): pth for pth in glob.iglob(include) })

    deployer.deploy(args.tarball, args.extract_path)
