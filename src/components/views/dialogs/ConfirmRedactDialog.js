/*
Copyright 2017 Vector Creations Ltd

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
import createReactClass from 'create-react-class';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';

/*
 * A dialog for confirming a redaction.
 */
export default createReactClass({
    displayName: 'ConfirmRedactDialog',

    render: function() {
        const QuestionDialog = sdk.getComponent('views.dialogs.QuestionDialog');
        return (
            <QuestionDialog onFinished={this.props.onFinished}
                title={_t("Confirm Removal")}
                description={
                    _t("Are you sure you wish to remove (delete) this event? " +
                       "Note that if you delete a room name or topic change, it could undo the change.")}
                button={_t("Remove")}>
            </QuestionDialog>
        );
    },
});
