/*
Copyright 2018 New Vector Ltd

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

import React from 'react';
import QuestionDialog from './QuestionDialog';
import Modal from '../../../Modal';
import dis from '../../../dispatcher';
import { _t } from '../../../languageHandler';
import MatrixClientPeg from '../../../MatrixClientPeg';

export default (props) => {
    const description = _t("For security, logging out will delete any end-to-end " +
                  "encryption keys from this browser. If you want to be able " +
                  "to decrypt your conversation history from future Riot sessions, " +
                  "please export your room keys for safe-keeping.");

    const onExportE2eKeysClicked = () => {
        Modal.createTrackedDialogAsync('Export E2E Keys', '',
            import('../../../async-components/views/dialogs/ExportE2eKeysDialog'),
            {
                matrixClient: MatrixClientPeg.get(),
            },
        );
    };

    const onFinished = (confirmed) => {
        if (confirmed) {
            dis.dispatch({action: 'logout'});
        }
        // close dialog
        if (props.onFinished) {
            props.onFinished();
        }
    };

    return (<QuestionDialog
        hasCancelButton={true}
        title={_t("Sign out")}
        description={<div>{description}</div>}
        button={_t("Sign out")}
        extraButtons={[
            (<button key="export" className="mx_Dialog_primary"
                    onClick={onExportE2eKeysClicked}>
               { _t("Export E2E room keys") }
            </button>),
        ]}
        onFinished={onFinished}
    />);
};
