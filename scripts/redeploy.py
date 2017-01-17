#!/usr/bin/env python
#
# auto-deploy script for https://riot.im/develop
#
# Listens for HTTP hits. When it gets one, downloads the artifact from jenkins
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
from urlparse import urljoin

from flask import Flask, jsonify, request, abort

from deploy import Deployer, DeployException

app = Flask(__name__)

arg_jenkins_url = None
deployer = None
arg_extract_path = None
arg_symlink = None

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

@app.route("/", methods=["POST"])
def on_receive_jenkins_poke():
    # {
    #    "name": "VectorWebDevelop",
    #    "build": {
    #        "number": 8
    #    }
    # }
    incoming_json = request.get_json()
    if not incoming_json:
        abort(400, "No JSON provided!")
        return
    print("Incoming JSON: %s" % (incoming_json,))

    job_name = incoming_json.get("name")
    if not isinstance(job_name, basestring):
        abort(400, "Bad job name: %s" % (job_name,))
        return

    build_num = incoming_json.get("build", {}).get("number", 0)
    if not build_num or build_num <= 0 or not isinstance(build_num, int):
        abort(400, "Missing or bad build number")
        return

    return fetch_jenkins_build(job_name, build_num)

def fetch_jenkins_build(job_name, build_num):
    artifact_url = urljoin(
        arg_jenkins_url, "job/%s/%s/api/json" % (job_name, build_num)
    )
    artifact_response = requests.get(artifact_url).json()

    # {
    # "actions": [],
    # "artifacts": [
    #   {
    #   "displayPath": "vector-043f6991a4ed-react-20f77d1224ef-js-0a7efe3e8bd5.tar.gz",
    #   "fileName": "vector-043f6991a4ed-react-20f77d1224ef-js-0a7efe3e8bd5.tar.gz",
    #   "relativePath": "vector-043f6991a4ed-react-20f77d1224ef-js-0a7efe3e8bd5.tar.gz"
    #   }
    # ],
    # "building": false,
    # "description": null,
    # "displayName": "#11",
    # "duration": 137976,
    # "estimatedDuration": 132008,
    # "executor": null,
    # "fullDisplayName": "VectorWebDevelop #11",
    # "id": "11",
    # "keepLog": false,
    # "number": 11,
    # "queueId": 12254,
    # "result": "SUCCESS",
    # "timestamp": 1454432640079,
    # "url": "http://matrix.org/jenkins/job/VectorWebDevelop/11/",
    # "builtOn": "",
    # "changeSet": {},
    # "culprits": []
    # }
    if artifact_response.get("result") != "SUCCESS":
        abort(404, "Not deploying. Build was not marked as SUCCESS.")
        return

    if len(artifact_response.get("artifacts", [])) != 1:
        abort(404, "Not deploying. Build has an unexpected number of artifacts.")
        return

    tar_gz_path = artifact_response["artifacts"][0]["relativePath"]
    if not tar_gz_path.endswith(".tar.gz"):
        abort(404, "Not deploying. Artifact is not a .tar.gz file")
        return

    tar_gz_url = urljoin(
        arg_jenkins_url, "job/%s/%s/artifact/%s" % (job_name, build_num, tar_gz_path)
    )

    # we extract into a directory based on the build number. This avoids the
    # problem of multiple builds building the same git version and thus having
    # the same tarball name. That would lead to two potential problems:
    #   (a) sometimes jenkins serves corrupted artifacts; we would replace
    #       a good deploy with a bad one
    #   (b) we'll be overwriting the live deployment, which means people might
    #       see half-written files.
    build_dir = os.path.join(arg_extract_path, "%s-#%s" % (job_name, build_num))
    try:
        extracted_dir = deploy_tarball(tar_gz_url, build_dir)
    except DeployException as e:
        abort(400, e.message)

    create_symlink(source=extracted_dir, linkname=arg_symlink)

    return jsonify({})

def deploy_tarball(tar_gz_url, build_dir):
    """Download a tarball from jenkins and unpack it

    Returns:
        (str) the path to the unpacked deployment
    """
    if os.path.exists(build_dir):
        raise DeployException(
            "Not deploying. We have previously deployed this build."
        )
    os.mkdir(build_dir)

    # we rely on the fact that flask only serves one request at a time to
    # ensure that we do not overwrite a tarball from a concurrent request.

    return deployer.deploy(tar_gz_url, build_dir)


if __name__ == "__main__":
    parser = argparse.ArgumentParser("Runs a Vector redeployment server.")
    parser.add_argument(
        "-j", "--jenkins", dest="jenkins", default="https://matrix.org/jenkins/", help=(
            "The base URL of the Jenkins web server. This will be hit to get the\
            built artifacts (the .gz file) for redeploying."
        )
    )
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
    parser.add_argument(
        "--config", dest="config", help=(
            "Write a symlink to config.json in the extracted tarball. \
            To this location."
        )
    )
    parser.add_argument(
        "--test", dest="tarball_uri", help=(
            "Don't start an HTTP listener. Instead download a build from Jenkins \
            immediately."
        ),
    )

    args = parser.parse_args()
    if args.jenkins.endswith("/"): # important for urljoin
        arg_jenkins_url = args.jenkins
    else:
        arg_jenkins_url = args.jenkins + "/"
    arg_extract_path = args.extract
    arg_symlink = args.symlink

    if not os.path.isdir(arg_extract_path):
        os.mkdir(arg_extract_path)

    deployer = Deployer()
    deployer.bundles_path = args.bundles_dir
    deployer.should_clean = args.clean
    deployer.config_location = args.config

    if args.tarball_uri is not None:
        build_dir = os.path.join(arg_extract_path, "test-%i" % (time.time()))
        deploy_tarball(args.tarball_uri, build_dir)
    else:
        print(
            "Listening on port %s. Extracting to %s%s. Symlinking to %s. Jenkins URL: %s. Config location: %s" %
            (args.port,
             arg_extract_path,
             " (clean after)" if deployer.should_clean else "",
             arg_symlink,
             arg_jenkins_url,
             deployer.config_location,
            )
        )
        app.run(host="0.0.0.0", port=args.port, debug=True)
