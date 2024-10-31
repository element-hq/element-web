/*
Copyright 2022-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { readBuildConfig } from "../BuildConfig";
import { installer } from "../installer";

const buildConf = readBuildConfig();
installer(buildConf);
