#!/usr/bin/env sh
# Copyright 2025 New Vector Ltd.
#
# SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
# Please see LICENSE files in the project root for full details.

# A script to run a command in a python virtual environment that is stored in
# `<repo-root>/.venv`. If the virtual environment doesn't exist yet, it will
# be created.
#
# Example: $ ./run_in_venv.sh python --version

set -e

cd -- "$(dirname -- "$0")/.."

repo_root=$(git rev-parse --show-cdup)
venv_path=${repo_root:-./}.venv

if [ ! -d "$venv_path" ]; then
    "python${PYTHON_VERSION:-3}" -m venv "$venv_path"
    "$venv_path/bin/pip" install -e '.[dev]'
fi

[ $# -gt 1 ] && . "$venv_path/bin/activate" && "$@"
