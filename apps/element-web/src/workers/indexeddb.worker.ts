/*
Copyright 2024 New Vector Ltd.
Copyright 2017 Vector Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { IndexedDBStoreWorker } from "matrix-js-sdk/src/indexeddb-worker";

const ctx: Worker = self as any;

const remoteWorker = new IndexedDBStoreWorker(ctx.postMessage);

ctx.onmessage = remoteWorker.onMessage;
