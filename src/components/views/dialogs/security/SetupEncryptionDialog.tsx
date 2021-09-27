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

import React from 'react';
import SetupEncryptionBody from '../../../structures/auth/SetupEncryptionBody';
import BaseDialog from '../BaseDialog';
import { _t } from '../../../../languageHandler';
import { SetupEncryptionStore, Phase } from '../../../../stores/SetupEncryptionStore';
import { replaceableComponent } from "../../../../utils/replaceableComponent";
import { IDialogProps } from "../IDialogProps";

function iconFromPhase(phase: Phase) {
    if (phase === Phase.Done) {
        return require("../../../../../res/img/e2e/verified.svg");
    } else {
        return require("../../../../../res/img/e2e/warning.svg");
    }
}

interface IProps extends IDialogProps {}
interface IState {
    icon: string;
}

@replaceableComponent("views.dialogs.security.SetupEncryptionDialog")
export default class SetupEncryptionDialog extends React.Component<IProps, IState> {
    private store: SetupEncryptionStore;

    constructor(props: IProps) {
        super(props);

        this.store = SetupEncryptionStore.sharedInstance();
        this.state = { icon: iconFromPhase(this.store.phase) };
    }

    public componentDidMount() {
        this.store.on("update", this.onStoreUpdate);
    }

    public componentWillUnmount() {
        this.store.removeListener("update", this.onStoreUpdate);
    }

    private onStoreUpdate = (): void => {
        this.setState({ icon: iconFromPhase(this.store.phase) });
    };

    public render() {
        return <BaseDialog
            headerImage={this.state.icon}
            onFinished={this.props.onFinished}
            title={_t("Verify this session")}
        >
            <SetupEncryptionBody onFinished={this.props.onFinished} />
        </BaseDialog>;
    }
}
