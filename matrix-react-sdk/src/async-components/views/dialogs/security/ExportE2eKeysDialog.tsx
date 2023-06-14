/*
Copyright 2017 Vector Creations Ltd
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import FileSaver from "file-saver";
import React, { ChangeEvent } from "react";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../languageHandler";
import * as MegolmExportEncryption from "../../../../utils/MegolmExportEncryption";
import BaseDialog from "../../../../components/views/dialogs/BaseDialog";
import Field from "../../../../components/views/elements/Field";
import { KeysStartingWith } from "../../../../@types/common";

enum Phase {
    Edit = "edit",
    Exporting = "exporting",
}

interface IProps {
    matrixClient: MatrixClient;
    onFinished(doExport?: boolean): void;
}

interface IState {
    phase: Phase;
    errStr: string | null;
    passphrase1: string;
    passphrase2: string;
}

type AnyPassphrase = KeysStartingWith<IState, "passphrase">;

export default class ExportE2eKeysDialog extends React.Component<IProps, IState> {
    private unmounted = false;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            phase: Phase.Edit,
            errStr: null,
            passphrase1: "",
            passphrase2: "",
        };
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
    }

    private onPassphraseFormSubmit = (ev: React.FormEvent): boolean => {
        ev.preventDefault();

        const passphrase = this.state.passphrase1;
        if (passphrase !== this.state.passphrase2) {
            this.setState({ errStr: _t("Passphrases must match") });
            return false;
        }
        if (!passphrase) {
            this.setState({ errStr: _t("Passphrase must not be empty") });
            return false;
        }

        this.startExport(passphrase);
        return false;
    };

    private startExport(passphrase: string): void {
        // extra Promise.resolve() to turn synchronous exceptions into
        // asynchronous ones.
        Promise.resolve()
            .then(() => {
                return this.props.matrixClient.exportRoomKeys();
            })
            .then((k) => {
                return MegolmExportEncryption.encryptMegolmKeyFile(JSON.stringify(k), passphrase);
            })
            .then((f) => {
                const blob = new Blob([f], {
                    type: "text/plain;charset=us-ascii",
                });
                FileSaver.saveAs(blob, "element-keys.txt");
                this.props.onFinished(true);
            })
            .catch((e) => {
                logger.error("Error exporting e2e keys:", e);
                if (this.unmounted) {
                    return;
                }
                const msg = e.friendlyText || _t("Unknown error");
                this.setState({
                    errStr: msg,
                    phase: Phase.Edit,
                });
            });

        this.setState({
            errStr: null,
            phase: Phase.Exporting,
        });
    }

    private onCancelClick = (ev: React.MouseEvent): boolean => {
        ev.preventDefault();
        this.props.onFinished(false);
        return false;
    };

    private onPassphraseChange = (ev: React.ChangeEvent<HTMLInputElement>, phrase: AnyPassphrase): void => {
        this.setState({
            [phrase]: ev.target.value,
        } as Pick<IState, AnyPassphrase>);
    };

    public render(): React.ReactNode {
        const disableForm = this.state.phase === Phase.Exporting;

        return (
            <BaseDialog
                className="mx_exportE2eKeysDialog"
                onFinished={this.props.onFinished}
                title={_t("Export room keys")}
            >
                <form onSubmit={this.onPassphraseFormSubmit}>
                    <div className="mx_Dialog_content">
                        <p>
                            {_t(
                                "This process allows you to export the keys for messages " +
                                    "you have received in encrypted rooms to a local file. You " +
                                    "will then be able to import the file into another Matrix " +
                                    "client in the future, so that client will also be able to " +
                                    "decrypt these messages.",
                            )}
                        </p>
                        <p>
                            {_t(
                                "The exported file will allow anyone who can read it to decrypt " +
                                    "any encrypted messages that you can see, so you should be " +
                                    "careful to keep it secure. To help with this, you should enter " +
                                    "a passphrase below, which will be used to encrypt the exported " +
                                    "data. It will only be possible to import the data by using the " +
                                    "same passphrase.",
                            )}
                        </p>
                        <div className="error">{this.state.errStr}</div>
                        <div className="mx_E2eKeysDialog_inputTable">
                            <div className="mx_E2eKeysDialog_inputRow">
                                <Field
                                    label={_t("Enter passphrase")}
                                    value={this.state.passphrase1}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                        this.onPassphraseChange(e, "passphrase1")
                                    }
                                    autoFocus={true}
                                    size={64}
                                    type="password"
                                    disabled={disableForm}
                                />
                            </div>
                            <div className="mx_E2eKeysDialog_inputRow">
                                <Field
                                    label={_t("Confirm passphrase")}
                                    value={this.state.passphrase2}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                        this.onPassphraseChange(e, "passphrase2")
                                    }
                                    size={64}
                                    type="password"
                                    disabled={disableForm}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="mx_Dialog_buttons">
                        <input
                            className="mx_Dialog_primary"
                            type="submit"
                            value={_t("Export")}
                            disabled={disableForm}
                        />
                        <button onClick={this.onCancelClick} disabled={disableForm}>
                            {_t("Cancel")}
                        </button>
                    </div>
                </form>
            </BaseDialog>
        );
    }
}
