#!/usr/bin/env python
#
# auto-deploy script for https://riot.im/develop
#
# Listens for buildkite webhook pokes (https://buildkite.com/docs/apis/webhooks)
# When it gets one, downloads the artifact from buildkite
# and deploys it as the new version.
#
# Requires the following python packages:
#
#   - requests
#   - flask
#
from __future__ import print_function
import json, requests, tarfile, argparse, os, errno
import time
import traceback
from urlparse import urljoin
import glob
import re
import shutil
import threading
from Queue import Queue

from flask import Flask, jsonify, request, abort

from deploy import Deployer, DeployException

app = Flask(__name__)

deployer = None
arg_extract_path = None
arg_symlink = None
arg_webhook_token = None
arg_api_token = None

workQueue = Queue()

def create_symlink(source, linkname):
    try:
        os.symlink(source, linkname)
    except OSError, e:
        if e.errno == errno.EEXIST:
            # atomic modification
            os.symlink(source, linkname + ".tmp")
            os.rename(linkname + ".tmp", linkname)
        else:
            raise e

def req_headers():
    return {
        "Authorization": "Bearer %s" % (arg_api_token,),
    }

# Buildkite considers a poke to have failed if it has to wait more than 10s for
# data (any data, not just the initial response) and it normally takes longer than
# that to download an artifact from buildkite. Apparently there is no way in flask
# to finish the response and then keep doing stuff, so instead this has to involve
# threading. Sigh.
def worker_thread():
    while True:
        toDeploy = workQueue.get()
        deploy_buildkite_artifact(*toDeploy)

@app.route("/", methods=["POST"])
def on_receive_buildkite_poke():
    got_webhook_token = request.headers.get('X-Buildkite-Token')
    if got_webhook_token != arg_webbook_token:
        print("Denying request with incorrect webhook token: %s" % (got_webhook_token,))
        abort(400, "Incorrect webhook token")
        return

    required_api_prefix = None
    if arg_buildkite_org is not None:
        required_api_prefix = 'https://api.buildkite.com/v2/organizations/%s' % (arg_buildkite_org,)

    incoming_json = request.get_json()
    if not incoming_json:
        abort(400, "No JSON provided!")
        return
    print("Incoming JSON: %s" % (incoming_json,))

    event = incoming_json.get("event")
    if event is None:
        abort(400, "No 'event' specified")
        return

    if event == 'ping':
        print("Got ping request - responding")
        return jsonify({'response': 'pong!'})

    if event != 'build.finished':
        print("Rejecting '%s' event")
        abort(400, "Unrecognised event")
        return

    build_obj = incoming_json.get("build")
    if build_obj is None:
        abort(400, "No 'build' object")
        return

    build_url = build_obj.get('url')
    if build_url is None:
        abort(400, "build has no url")
        return

    if required_api_prefix is not None and not build_url.startswith(required_api_prefix):
        print("Denying poke for build url with incorrect prefix: %s" % (build_url,))
        abort(400, "Invalid build url")
        return

    build_num = build_obj.get('number')
    if build_num is None:
        abort(400, "build has no number")
        return

    pipeline_obj = incoming_json.get("pipeline")
    if pipeline_obj is None:
        abort(400, "No 'pipeline' object")
        return

    pipeline_name = pipeline_obj.get('name')
    if pipeline_name is None:
        abort(400, "pipeline has no name")
        return

    artifacts_url = build_url + "/artifacts"
    artifacts_resp = requests.get(artifacts_url, headers=req_headers())
    artifacts_resp.raise_for_status()
    artifacts_array = artifacts_resp.json()
    
    artifact_to_deploy = None
    for artifact in artifacts_array:
        if re.match(r"dist/.*.tar.gz", artifact['path']):
            artifact_to_deploy = artifact
    if artifact_to_deploy is None:
        print("No suitable artifacts found")
        return jsonify({})

    # double paranoia check: make sure the artifact is on the right org too
    if required_api_prefix is not None and not artifact_to_deploy['url'].startswith(required_api_prefix):
        print("Denying poke for build url with incorrect prefix: %s" % (artifact_to_deploy['url'],))
        abort(400, "Refusing to deploy artifact from URL %s", artifact_to_deploy['url'])
        return

    # there's no point building up a queue of things to deploy, so if there are any pending jobs,
    # remove them
    while not workQueue.empty():
        try:
            workQueue.get(False)
        except:
            pass
    workQueue.put([artifact_to_deploy, pipeline_name, build_num])

    return jsonify({})

def deploy_buildkite_artifact(artifact, pipeline_name, build_num):
    artifact_response = requests.get(artifact['url'], headers=req_headers())
    artifact_response.raise_for_status()
    artifact_obj = artifact_response.json()

    # we extract into a directory based on the build number. This avoids the
    # problem of multiple builds building the same git version and thus having
    # the same tarball name. That would lead to two potential problems:
    #   (a) sometimes jenkins serves corrupted artifacts; we would replace
    #       a good deploy with a bad one
    #   (b) we'll be overwriting the live deployment, which means people might
    #       see half-written files.
    build_dir = os.path.join(arg_extract_path, "%s-#%s" % (pipeline_name, build_num))
    try:
        extracted_dir = deploy_tarball(artifact_obj, build_dir)
    except DeployException as e:
        traceback.print_exc()
        abort(400, e.message)

    create_symlink(source=extracted_dir, linkname=arg_symlink)

def deploy_tarball(artifact, build_dir):
    """Download a tarball from jenkins and unpack it

    Returns:
        (str) the path to the unpacked deployment
    """
    if os.path.exists(build_dir):
        raise DeployException(
            "Not deploying. We have previously deployed this build."
        )
    os.mkdir(build_dir)

    print("Fetching artifact %s -> %s..." % (artifact['download_url'], artifact['filename']))

    # Download the tarball here as buildkite needs auth to do this
    # we don't pgp-sign buildkite artifacts, relying on HTTPS and buildkite
    # not being evil. If that's not good enough for you, don't use riot.im/develop.
    resp = requests.get(artifact['download_url'], stream=True, headers=req_headers())
    resp.raise_for_status()
    with open(artifact['filename'], 'wb') as ofp:
        shutil.copyfileobj(resp.raw, ofp)
    print("...download complete. Deploying...")

    # we rely on the fact that flask only serves one request at a time to
    # ensure that we do not overwrite a tarball from a concurrent request.

    return deployer.deploy(artifact['filename'], build_dir)


if __name__ == "__main__":
    parser = argparse.ArgumentParser("Runs a Vector redeployment server.")
    parser.add_argument(
        "-p", "--port", dest="port", default=4000, type=int, help=(
            "The port to listen on for requests from Jenkins."
        )
    )
    parser.add_argument(
        "-e", "--extract", dest="extract", default="./extracted", help=(
            "The location to extract .tar.gz files to."
        )
    )
    parser.add_argument(
        "-b", "--bundles-dir", dest="bundles_dir", help=(
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
        "-s", "--symlink", dest="symlink", default="./latest", help=(
            "Write a symlink to this location pointing to the extracted tarball. \
            New builds will keep overwriting this symlink. The symlink will point \
            to the /vector directory INSIDE the tarball."
        )
    )

    # --include ../../config.json ./localhost.json homepages/*
    parser.add_argument(
        "--include", nargs='*', default='./config*.json', help=(
            "Symlink these files into the root of the deployed tarball. \
             Useful for config files and home pages. Supports glob syntax. \
             (Default: '%(default)s')"
        )
    )
    parser.add_argument(
        "--test", dest="tarball_uri", help=(
            "Don't start an HTTP listener. Instead download a build from Jenkins \
            immediately."
        ),
    )

    parser.add_argument(
        "--webhook-token", dest="webhook_token", help=(
            "Only accept pokes with this buildkite token."
        ), required=True,
    )

    parser.add_argument(
        "--api-token", dest="api_token", help=(
            "API access token for buildkite. Require read_artifacts scope."
        ), required=True,
    )

    # We require a matching webhook token, but because we take everything else
    # about what to deploy from the poke body, we can be a little more paranoid
    # and only accept builds / artifacts from a specific buildkite org
    parser.add_argument(
        "--org", dest="buildkite_org", help=(
            "Lock down to this buildkite org"
        )
    )

    args = parser.parse_args()
    arg_extract_path = args.extract
    arg_symlink = args.symlink
    arg_webbook_token = args.webhook_token
    arg_api_token = args.api_token
    arg_buildkite_org = args.buildkite_org

    if not os.path.isdir(arg_extract_path):
        os.mkdir(arg_extract_path)

    deployer = Deployer()
    deployer.bundles_path = args.bundles_dir
    deployer.should_clean = args.clean

    for include in args.include:
        deployer.symlink_paths.update({ os.path.basename(pth): pth for pth in glob.iglob(include) })

    if args.tarball_uri is not None:
        build_dir = os.path.join(arg_extract_path, "test-%i" % (time.time()))
        deploy_tarball(args.tarball_uri, build_dir)
    else:
        print(
            "Listening on port %s. Extracting to %s%s. Symlinking to %s. Include files: %s" %
            (args.port,
             arg_extract_path,
             " (clean after)" if deployer.should_clean else "",
             arg_symlink,
             deployer.symlink_paths,
            )
        )
        fred = threading.Thread(target=worker_thread)
        fred.daemon = True
        fred.start()
        app.run(port=args.port, debug=False)
