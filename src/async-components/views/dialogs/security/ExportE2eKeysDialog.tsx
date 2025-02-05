/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2017 Vector Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import FileSaver from "file-saver";
import React, { type ChangeEvent } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t, _td } from "../../../../languageHandler";
import * as MegolmExportEncryption from "../../../../utils/MegolmExportEncryption";
import BaseDialog from "../../../../components/views/dialogs/BaseDialog";
import { type KeysStartingWith } from "../../../../@types/common";
import PassphraseField from "../../../../components/views/auth/PassphraseField";
import PassphraseConfirmField from "../../../../components/views/auth/PassphraseConfirmField";
import type Field from "../../../../components/views/elements/Field";

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
    private fieldPassword: Field | null = null;
    private fieldPasswordConfirm: Field | null = null;

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

    public componentDidMount(): void {
        this.unmounted = false;
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
    }

    private async verifyFieldsBeforeSubmit(): Promise<boolean> {
        const fieldsInDisplayOrder = [this.fieldPassword, this.fieldPasswordConfirm];

        const invalidFields: Field[] = [];

        for (const field of fieldsInDisplayOrder) {
            if (!field) continue;

            const valid = await field.validate({ allowEmpty: false });
            if (!valid) {
                invalidFields.push(field);
            }
        }

        if (invalidFields.length === 0) {
            return true;
        }

        // Focus on the first invalid field, then re-validate,
        // which will result in the error tooltip being displayed for that field.
        invalidFields[0].focus();
        invalidFields[0].validate({ allowEmpty: false, focused: true });

        return false;
    }

    private onPassphraseFormSubmit = async (ev: React.FormEvent): Promise<void> => {
        ev.preventDefault();

        if (!(await this.verifyFieldsBeforeSubmit())) return;
        if (this.unmounted) return;

        const passphrase = this.state.passphrase1;
        this.startExport(passphrase);
    };

    private startExport(passphrase: string): void {
        // extra Promise.resolve() to turn synchronous exceptions into
        // asynchronous ones.
        Promise.resolve()
            .then(() => {
                return this.props.matrixClient.getCrypto()!.exportRoomKeysAsJson();
            })
            .then((k) => {
                return MegolmExportEncryption.encryptMegolmKeyFile(k, passphrase);
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
                const msg = e.friendlyText || _t("error|unknown");
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
                title={_t("settings|key_export_import|export_title")}
            >
                <form onSubmit={this.onPassphraseFormSubmit}>
                    <div className="mx_Dialog_content">
                        <p>{_t("settings|key_export_import|export_description_1")}</p>
                        <p>{_t("settings|key_export_import|export_description_2")}</p>
                        <div className="error">{this.state.errStr}</div>
                        <div className="mx_E2eKeysDialog_inputTable">
                            <div className="mx_E2eKeysDialog_inputRow">
                                <PassphraseField
                                    minScore={3}
                                    label={_td("settings|key_export_import|enter_passphrase")}
                                    labelEnterPassword={_td("settings|key_export_import|enter_passphrase")}
                                    labelStrongPassword={_td("settings|key_export_import|phrase_strong_enough")}
                                    labelAllowedButUnsafe={_td("settings|key_export_import|phrase_strong_enough")}
                                    value={this.state.passphrase1}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                        this.onPassphraseChange(e, "passphrase1")
                                    }
                                    autoFocus={true}
                                    size={64}
                                    type="password"
                                    disabled={disableForm}
                                    autoComplete="new-password"
                                    fieldRef={(field) => (this.fieldPassword = field)}
                                />
                            </div>
                            <div className="mx_E2eKeysDialog_inputRow">
                                <PassphraseConfirmField
                                    password={this.state.passphrase1}
                                    label={_td("settings|key_export_import|confirm_passphrase")}
                                    labelRequired={_td("settings|key_export_import|phrase_cannot_be_empty")}
                                    labelInvalid={_td("settings|key_export_import|phrase_must_match")}
                                    value={this.state.passphrase2}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                        this.onPassphraseChange(e, "passphrase2")
                                    }
                                    size={64}
                                    type="password"
                                    disabled={disableForm}
                                    autoComplete="new-password"
                                    fieldRef={(field) => (this.fieldPasswordConfirm = field)}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="mx_Dialog_buttons">
                        <input
                            className="mx_Dialog_primary"
                            type="submit"
                            value={_t("action|export")}
                            disabled={disableForm}
                        />
                        <button onClick={this.onCancelClick} disabled={disableForm}>
                            {_t("action|cancel")}
                        </button>
                    </div>
                </form>
            </BaseDialog>
        );
    }
}
