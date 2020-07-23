/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import SdkConfig from "./SdkConfig";
import ToastStore from "./stores/ToastStore";
import GenericToast from "./components/views/toasts/GenericToast";
import RebrandDialog from "./components/views/dialogs/RebrandDialog";
import { RebrandDialogKind } from "./components/views/dialogs/RebrandDialog";
import Modal from './Modal';
import { _t } from './languageHandler';

const TOAST_KEY = 'rebrand';
const NAG_INTERVAL = 24 * 60 * 60 * 1000;

function getRedirectUrl(url): string {
    const redirectUrl = new URL(url);
    redirectUrl.hash = '';

    if (SdkConfig.get()['redirectToNewBrandUrl']) {
        const newUrl = new URL(SdkConfig.get()['redirectToNewBrandUrl']);
        if (url.hostname !== newUrl.hostname || url.pathname !== newUrl.pathname) {
            redirectUrl.hostname = newUrl.hostname;
            redirectUrl.pathname = newUrl.pathname;
            return redirectUrl.toString();
        }
        return null;
    } else if (url.hostname === 'riot.im') {
        if (url.pathname.startsWith('/app')) {
            redirectUrl.hostname = 'app.element.io';
            redirectUrl.pathname = '/';
        } else if (url.pathname.startsWith('/staging')) {
            redirectUrl.hostname = 'staging.element.io';
            redirectUrl.pathname = '/';
        } else if (url.pathname.startsWith('/develop')) {
            redirectUrl.hostname = 'develop.element.io';
            redirectUrl.pathname = '/';
        }

        return redirectUrl.href;
    } else if (url.hostname.endsWith('.riot.im')) {
        redirectUrl.hostname = url.hostname.substr(0, url.hostname.length - '.riot.im'.length) + '.element.io';
        return redirectUrl.href;
    } else {
        return null;
    }
}

/**
 * Shows toasts informing the user that the name of the app has changed and,
 * potentially, that they should head to a different URL and log in there
 */
export default class RebrandListener {
    private _reshowTimer?: number;
    private nagAgainAt?: number = null;

    static sharedInstance() {
        if (!window.mxRebrandListener) window.mxRebrandListener = new RebrandListener();
        return window.mxRebrandListener;
    }

    constructor() {
        this._reshowTimer = null;
    }

    start() {
        this.recheck();
    }

    stop() {
        if (this._reshowTimer) {
            clearTimeout(this._reshowTimer);
            this._reshowTimer = null;
        }
    }

    onNagToastLearnMore = async () => {
        const [doneClicked] = await Modal.createDialog(RebrandDialog, {
            kind: RebrandDialogKind.NAG,
            targetUrl: getRedirectUrl(window.location),
        }).finished;
        if (doneClicked) {
            // open in new tab: they should come back here & log out
            window.open(getRedirectUrl(window.location), '_blank');
        }

        // whatever the user clicks, we go away & nag again after however long:
        // If they went to the new URL, we want to nag them to log out if they
        // come back to this tab, and if they clicked, 'remind me later' we want
        // to, well, remind them later.
        this.nagAgainAt = Date.now() + NAG_INTERVAL;
        this.recheck();
    };

    onOneTimeToastLearnMore = async () => {
        const [doneClicked] = await Modal.createDialog(RebrandDialog, {
            kind: RebrandDialogKind.ONE_TIME,
        }).finished;
        if (doneClicked) {
            localStorage.setItem('mx_rename_dialog_dismissed', 'true');
            this.recheck();
        }
    };

    onOneTimeToastDismiss = async () => {
        localStorage.setItem('mx_rename_dialog_dismissed', 'true');
        this.recheck();
    };

    onNagTimerFired = () => {
        this._reshowTimer = null;
        this.nagAgainAt = null;
        this.recheck();
    };

    private async recheck() {
        // There are two types of toast/dialog we show: a 'one time' informing the user that
        // the app is now called a different thing but no action is required from them (they
        // may need to look for a different name name/icon to launch the app but don't need to
        // log in again) and a nag toast where they need to log in to the app on a different domain.
        let nagToast = false;
        let oneTimeToast = false;

        if (getRedirectUrl(window.location)) {
            if (!this.nagAgainAt) {
                // if we have redirectUrl, show the nag toast
                nagToast = true;
            }
        } else {
            // otherwise we show the 'one time' toast / dialog
            const renameDialogDismissed = localStorage.getItem('mx_rename_dialog_dismissed');
            if (renameDialogDismissed !== 'true') {
                oneTimeToast = true;
            }
        }

        if (nagToast || oneTimeToast) {
            let description;
            let rejectLabel = null;
            let onReject = null;
            if (nagToast) {
                description = _t("Use your account to sign in to the latest version");
            } else {
                description = _t("We’re excited to announce Riot is now Element");
                rejectLabel = _t("Dismiss");
                onReject = this.onOneTimeToastDismiss;
            }

            ToastStore.sharedInstance().addOrReplaceToast({
                key: TOAST_KEY,
                title: _t("Riot is now Element!"),
                icon: 'element_logo',
                props: {
                    description,
                    acceptLabel: _t("Learn More"),
                    onAccept: nagToast ? this.onNagToastLearnMore : this.onOneTimeToastLearnMore,
                    rejectLabel,
                    onReject,
                },
                component: GenericToast,
                priority: 20,
            });
        } else {
            ToastStore.sharedInstance().dismissToast(TOAST_KEY);
        }

        if (!this._reshowTimer && this.nagAgainAt) {
            // XXX: Our build system picks up NodeJS bindings when we need browser bindings.
            this._reshowTimer = setTimeout(this.onNagTimerFired, (this.nagAgainAt - Date.now()) + 100) as any as number;
        }
    }
}
