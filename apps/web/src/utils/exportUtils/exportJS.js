/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// This file is raw-imported (imported as plain text) for the export bundle, which is why this is in JS
function showToastIfNeeded(replyId) {
    const el = document.getElementById(replyId);
    if (!el) {
        showToast("The message you're looking for wasn't exported");
        return;
    }
}

function showToast(text) {
    const el = document.getElementById("snackbar");
    el.innerHTML = text;
    el.className = "mx_show";
    window.setTimeout(() => {
        el.className = el.className.replace("mx_show", "");
    }, 2000);
}

window.onload = () => {
    document.querySelectorAll(".mx_reply_anchor").forEach((element) => {
        element.addEventListener("click", (event) => {
            showToastIfNeeded(event.target.dataset.scrollTo);
        });
    });
};
