#!/usr/bin/env python

# auto-deploy script for https://develop.element.io

# Listens for Github Action webhook pokes (https://github.com/marketplace/actions/workflow-webhook-action)
# When it gets one: downloads the artifact from github actions and deploys it as the new version.

# Requires the following python packages:
#
#   - flask
#   - python-github-webhook

from __future__ import print_function
import argparse
import os
import errno
import time
import traceback

import glob
from io import BytesIO
from urllib.request import urlopen
from zipfile import ZipFile

from github_webhook import Webhook
from flask import Flask, abort

from deploy import Deployer, DeployException

app = Flask(__name__)
webhook = Webhook(app, endpoint="/")


def create_symlink(source: str, linkname: str):
    try:
        os.symlink(source, linkname)
    except OSError as e:
        if e.errno == errno.EEXIST:
            # atomic modification
            os.symlink(source, linkname + ".tmp")
            os.rename(linkname + ".tmp", linkname)
        else:
            raise e


@webhook.hook(event_type="workflow_run")
def on_deployment(payload: dict):
    repository = payload.get("repository")
    if repository is None:
        abort(400, "No 'repository' specified")
        return

    workflow = payload.get("workflow")
    if repository is None:
        abort(400, "No 'workflow' specified")
        return

    request_id = payload.get("requestID")
    if request_id is None:
        abort(400, "No 'request_id' specified")
        return

    if arg_github_org is not None and not repository.startswith(arg_github_org):
        print("Denying poke for repository with incorrect prefix: %s" % (repository,))
        abort(400, "Invalid repository")
        return

    if arg_github_workflow is not None and workflow != arg_github_workflow:
        print("Denying poke for incorrect workflow: %s" % (workflow,))
        abort(400, "Incorrect workflow")
        return

    artifact_url = payload.get("data", {}).get("url")
    if artifact_url is None:
        abort(400, "No 'data.url' specified")
        return

    deploy_artifact(artifact_url, request_id)


def deploy_artifact(artifact_url: str, request_id: str):
    # we extract into a directory based on the build number. This avoids the
    # problem of multiple builds building the same git version and thus having
    # the same tarball name. That would lead to two potential problems:
    #   (a) sometimes jenkins serves corrupted artifacts; we would replace
    #       a good deploy with a bad one
    #   (b) we'll be overwriting the live deployment, which means people might
    #       see half-written files.
    build_dir = os.path.join(arg_extract_path, "gha-%s" % (request_id,))

    if os.path.exists(build_dir):
        # We have already deployed this, nop
        return
    os.mkdir(build_dir)

    try:
        with urlopen(artifact_url) as f:
            with ZipFile(BytesIO(f.read()), "r") as z:
                name = next((x for x in z.namelist() if x.endswith(".tar.gz")))
                z.extract(name, build_dir)
        extracted_dir = deployer.deploy(os.path.join(build_dir, name), build_dir)
        create_symlink(source=extracted_dir, linkname=arg_symlink)
    except DeployException as e:
        traceback.print_exc()
        abort(400, str(e))
    finally:
        if deployer.should_clean:
            os.remove(os.path.join(build_dir, name))


if __name__ == "__main__":
    parser = argparse.ArgumentParser("Runs an Element redeployment server.")
    parser.add_argument(
        "-p", "--port", dest="port", default=4000, type=int, help=(
            "The port to listen on for redeployment requests."
        )
    )
    parser.add_argument(
        "-e", "--extract", dest="extract", default="./extracted", type=str, help=(
            "The location to extract .tar.gz files to."
        )
    )
    parser.add_argument(
        "-b", "--bundles-dir", dest="bundles_dir", type=str, help=(
            "A directory to move the contents of the 'bundles' directory to. A \
            symlink to the bundles directory will also be written inside the \
            extracted tarball. Example: './bundles'."
        )
    )
    parser.add_argument(
        "-c", "--clean", dest="clean", action="store_true", default=False, help=(
            "Remove .tar.gz files after they have been downloaded and extracted."
        )
    )
    parser.add_argument(
        "-s", "--symlink", dest="symlink", default="./latest", type=str, help=(
            "Write a symlink to this location pointing to the extracted tarball. \
            New builds will keep overwriting this symlink. The symlink will point \
            to the /vector directory INSIDE the tarball."
        )
    )

    # --include ../../config.json ./localhost.json homepages/*
    parser.add_argument(
        "--include", nargs='*', default='./config*.json', type=str, help=(
            "Symlink these files into the root of the deployed tarball. \
             Useful for config files and home pages. Supports glob syntax. \
             (Default: '%(default)s')"
        )
    )
    parser.add_argument(
        "--test", dest="tarball_uri", type=str, help=(
            "Don't start an HTTP listener. Instead download a build from this URL immediately."
        ),
    )

    parser.add_argument(
        "--webhook-token", dest="webhook_token", type=str, help=(
            "Only accept pokes signed with this github token."
        ), required=True,
    )

    # We require a matching webhook token, but because we take everything else
    # about what to deploy from the poke body, we can be a little more paranoid
    # and only accept builds / artifacts from a specific github org
    parser.add_argument(
        "--org", dest="github_org", type=str, help=(
            "Lock down to this github org"
        )
    )
    # Optional matching workflow name
    parser.add_argument(
        "--workflow", dest="github_workflow", type=str, help=(
            "Lock down to this github workflow"
        )
    )

    args = parser.parse_args()
    arg_extract_path = args.extract
    arg_symlink = args.symlink
    arg_github_org = args.github_org
    arg_github_workflow = args.github_workflow

    if not os.path.isdir(arg_extract_path):
        os.mkdir(arg_extract_path)

    webhook.secret = args.webhook_token

    deployer = Deployer()
    deployer.bundles_path = args.bundles_dir
    deployer.should_clean = args.clean

    for include in args.include.split(" "):
        deployer.symlink_paths.update({ os.path.basename(pth): pth for pth in glob.iglob(include) })

    print(
        "Listening on port %s. Extracting to %s%s. Symlinking to %s. Include files: %s" %
        (args.port,
         arg_extract_path,
         " (clean after)" if deployer.should_clean else "",
         arg_symlink,
         deployer.symlink_paths,
        )
    )

    app.run(port=args.port, debug=False)
