/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Import the js-sdk so the proper `request` object can be set. This does some
// magic with the browser injection to make all subsequent imports work fine.
import "matrix-js-sdk/src/browser-index";
