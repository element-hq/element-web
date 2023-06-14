/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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
