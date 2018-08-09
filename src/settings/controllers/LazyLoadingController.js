/*
Copyright 2018 New Vector

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

import SettingsStore from "../SettingsStore";
import SettingController from "./SettingController";
import Modal from "../../Modal";
import sdk from "../../index";
import MatrixClientPeg  from "../../MatrixClientPeg";
import dis from "../../dispatcher";
import { _t } from "../../languageHandler";

export default class LazyLoadingController extends SettingController {
    onChange(level, roomId, newValue) {
        dis.dispatch({action: 'flush_storage_reload'});
    }

    canChangeTo(level, roomId, newValue) {
        return new Promise((resolve) => this._showReloadDialog(resolve));
    }

    _showReloadDialog(onFinished) {
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        Modal.createDialog(QuestionDialog, {
            title: _t("Turn on/off lazy load members"),
            description:
                <div>
             { _t("To enable or disable the lazy loading of members, " + 
                "the current synced state needs to be cleared out. " + 
                "This also includes your end-to-end encryption keys, " +
                "so to keep being able to decrypt all your existing encrypted messages, " +
                "you'll need to export your E2E room keys and import them again afterwards.") }
                </div>,
            button: _t("Clear sync state and reload"),
            extraButtons: [
                <button key="export" className="mx_Dialog_primary"
                        onClick={this._onExportE2eKeysClicked}>
                   { _t("Export E2E room keys") }
                </button>,
            ],
            onFinished,
        });
    }

    _onExportE2eKeysClicked() {
        Modal.createTrackedDialogAsync('Export E2E Keys', '', (cb) => {
            require.ensure(['../../async-components/views/dialogs/ExportE2eKeysDialog'], () => {
                cb(require('../../async-components/views/dialogs/ExportE2eKeysDialog'));
            }, "e2e-export");
        }, {
            matrixClient: MatrixClientPeg.get(),
        });
    }
}
