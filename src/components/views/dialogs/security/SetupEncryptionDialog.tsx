/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import SetupEncryptionBody from "../../../structures/auth/SetupEncryptionBody";
import BaseDialog from "../BaseDialog";
import { _t } from "../../../../languageHandler";
import { SetupEncryptionStore, Phase } from "../../../../stores/SetupEncryptionStore";

function iconFromPhase(phase?: Phase): string {
    if (phase === Phase.Done) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require("../../../../../res/img/e2e/verified-deprecated.svg").default;
    } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require("../../../../../res/img/e2e/warning-deprecated.svg").default;
    }
}

interface IProps {
    onFinished(): void;
}
interface IState {
    icon: string;
}

export default class SetupEncryptionDialog extends React.Component<IProps, IState> {
    private store: SetupEncryptionStore;

    public constructor(props: IProps) {
        super(props);

        this.store = SetupEncryptionStore.sharedInstance();
        this.state = { icon: iconFromPhase(this.store.phase) };
    }

    public componentDidMount(): void {
        this.store.on("update", this.onStoreUpdate);
    }

    public componentWillUnmount(): void {
        this.store.removeListener("update", this.onStoreUpdate);
    }

    private onStoreUpdate = (): void => {
        this.setState({ icon: iconFromPhase(this.store.phase) });
    };

    public render(): React.ReactNode {
        return (
            <BaseDialog
                headerImage={this.state.icon}
                onFinished={this.props.onFinished}
                title={_t("encryption|verify_toast_title")}
            >
                <SetupEncryptionBody onFinished={this.props.onFinished} />
            </BaseDialog>
        );
    }
}
