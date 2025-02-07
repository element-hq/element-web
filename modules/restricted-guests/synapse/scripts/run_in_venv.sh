#!/usr/bin/env sh

# Copyright 2023 Nordeck IT + Consulting GmbH
# Copyright 2025 New Vector Ltd.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

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
    "$venv_path/bin/pip" install -e ."[dev]"
fi

[ $# -gt 1 ] && . "$venv_path/bin/activate" && "$@"
