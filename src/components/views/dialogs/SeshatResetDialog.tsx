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

import React from 'react';
import {_t} from "../../../languageHandler";
import {replaceableComponent} from "../../../utils/replaceableComponent";

import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";

interface IProps {
    onFinished(): void;
}

@replaceableComponent("views.dialogs.SeshatResetDialog")
export default class SeshatResetDialog extends React.PureComponent<IProps> {
    render() {
        return (
            <BaseDialog
                hasCancel={true}
                onFinished={this.props.onFinished.bind(null, false)}
                title={_t("Reset event index store?")}>
                <div>
                    <p>
                        {_t(
                            "Your event store appears corrupted. " +
                            "This action will restart this application.",
                        )}
                    </p>
                </div>
                <DialogButtons
                    primaryButton={_t("Reset event store")}
                    onPrimaryButtonClick={this.props.onFinished.bind(null, true)}
                    primaryButtonClass="danger"
                    cancelButton={_t("Cancel")}
                    onCancel={this.props.onFinished.bind(null, false)}
                />
            </BaseDialog>
        );
    }
}
