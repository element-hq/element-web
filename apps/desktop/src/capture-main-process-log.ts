/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Imported before anything else by electron-main, so that console output from the other modules'
// top-level code is captured too.
import { mainProcessLog } from "./main-process-log.js";

mainProcessLog.patchConsole(console);
