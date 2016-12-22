#!/usr/bin/env python
from __future__ import print_function
import json, requests, tarfile, argparse, os, errno
from urlparse import urljoin
from flask import Flask, jsonify, request, abort
app = Flask(__name__)

arg_jenkins_url, arg_extract_path, arg_should_clean, arg_symlink, arg_config_location = (
    None, None, None, None, None
)

def download_file(url):
    local_filename = url.split('/')[-1]
    r = requests.get(url, stream=True)
    with open(local_filename, 'wb') as f:
        for chunk in r.iter_content(chunk_size=1024):
            if chunk: # filter out keep-alive new chunks
                f.write(chunk)
    return local_filename

def untar_to(tarball, dest):
    with tarfile.open(tarball) as tar:
        tar.extractall(dest)

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

    print("Retrieving .tar.gz file: %s" % tar_gz_url)

    # we rely on the fact that flask only serves one request at a time to
    # ensure that we do not overwrite a tarball from a concurrent request.
    filename = download_file(tar_gz_url)
    print("Downloaded file: %s" % filename)

    try:
        # we extract into a directory based on the build number. This avoids the
        # problem of multiple builds building the same git version and thus having
        # the same tarball name.
        build_dir = os.path.join(arg_extract_path, "%s-#%s" % (job_name, build_num))
        if os.path.exists(build_dir):
            abort(400, "Not deploying. We have previously deployed this build.")
            return
        os.mkdir(build_dir)

        untar_to(filename, build_dir)
        print("Extracted to: %s" % build_dir)
    finally:
        if arg_should_clean:
            os.remove(filename)

    name_str = filename.replace(".tar.gz", "")
    extracted_dir = os.path.join(build_dir, name_str)

    if arg_config_location:
        create_symlink(source=arg_config_location, linkname=os.path.join(extracted_dir, 'config.json'))

    create_symlink(source=extracted_dir, linkname=arg_symlink)

    return jsonify({})

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
    args = parser.parse_args()
    if args.jenkins.endswith("/"): # important for urljoin
        arg_jenkins_url = args.jenkins
    else:
        arg_jenkins_url = args.jenkins + "/"
    arg_extract_path = args.extract
    arg_should_clean = args.clean
    arg_symlink = args.symlink
    arg_config_location = args.config
    print(
        "Listening on port %s. Extracting to %s%s. Symlinking to %s. Jenkins URL: %s. Config location: %s" %
        (args.port, arg_extract_path,
            " (clean after)" if arg_should_clean else "", arg_symlink, arg_jenkins_url, arg_config_location)
    )
    app.run(host="0.0.0.0", port=args.port, debug=True)
