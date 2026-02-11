/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2017 Vector Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import * as MegolmExportEncryption from "../../../../utils/MegolmExportEncryption";
import { _t } from "../../../../languageHandler";
import BaseDialog from "../../../../components/views/dialogs/BaseDialog";
import Field from "../../../../components/views/elements/Field";

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                resolve(e.target.result as ArrayBuffer);
            } else {
                reject(new Error("Failed to read file due to unknown error"));
            }
        };
        reader.onerror = reject;

        reader.readAsArrayBuffer(file);
    });
}

enum Phase {
    Edit = "edit",
    Importing = "importing",
}

interface IProps {
    matrixClient: MatrixClient;
    onFinished(imported?: boolean): void;
}

interface IState {
    enableSubmit: boolean;
    phase: Phase;
    errStr: string | null;
    passphrase: string;
}

export default class ImportE2eKeysDialog extends React.Component<IProps, IState> {
    private unmounted = false;
    private file = createRef<HTMLInputElement>();

    public constructor(props: IProps) {
        super(props);

        this.state = {
            enableSubmit: false,
            phase: Phase.Edit,
            errStr: null,
            passphrase: "",
        };
    }

    public componentDidMount(): void {
        this.unmounted = false;
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
    }

    private onFormChange = (): void => {
        const files = this.file.current?.files;
        this.setState({
            enableSubmit: this.state.passphrase !== "" && !!files?.length,
        });
    };

    private onPassphraseChange = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({ passphrase: ev.target.value }, this.onFormChange); // update general form state too
    };

    private onFormSubmit = (ev: React.FormEvent): boolean => {
        ev.preventDefault();
        // noinspection JSIgnoredPromiseFromCall
        const file = this.file.current?.files?.[0];
        if (file) {
            this.startImport(file, this.state.passphrase);
        }
        return false;
    };

    private startImport(file: File, passphrase: string): Promise<void> {
        this.setState({
            errStr: null,
            phase: Phase.Importing,
        });

        return readFileAsArrayBuffer(file)
            .then((arrayBuffer) => {
                return MegolmExportEncryption.decryptMegolmKeyFile(arrayBuffer, passphrase);
            })
            .then((keys) => {
                return this.props.matrixClient.getCrypto()!.importRoomKeysAsJson(keys);
            })
            .then(() => {
                // TODO: it would probably be nice to give some feedback about what we've imported here.
                this.props.onFinished(true);
            })
            .catch((e) => {
                logger.error("Error importing e2e keys:", e);
                if (this.unmounted) {
                    return;
                }
                const msg = e.friendlyText || _t("error|unknown");
                this.setState({
                    errStr: msg,
                    phase: Phase.Edit,
                });
            });
    }

    private onCancelClick = (ev: React.MouseEvent): boolean => {
        ev.preventDefault();
        this.props.onFinished(false);
        return false;
    };

    public render(): React.ReactNode {
        const disableForm = this.state.phase !== Phase.Edit;

        return (
            <BaseDialog
                className="mx_importE2eKeysDialog"
                onFinished={this.props.onFinished}
                title={_t("settings|key_export_import|import_title")}
            >
                <form onSubmit={this.onFormSubmit}>
                    <div className="mx_Dialog_content">
                        <p>{_t("settings|key_export_import|import_description_1")}</p>
                        <p>{_t("settings|key_export_import|import_description_2")}</p>
                        <div className="error">{this.state.errStr}</div>
                        <div className="mx_E2eKeysDialog_inputTable">
                            <div className="mx_E2eKeysDialog_inputRow">
                                <div className="mx_E2eKeysDialog_inputLabel">
                                    <label htmlFor="importFile">
                                        {_t("settings|key_export_import|file_to_import")}
                                    </label>
                                </div>
                                <div className="mx_E2eKeysDialog_inputCell">
                                    <input
                                        ref={this.file}
                                        id="importFile"
                                        type="file"
                                        autoFocus={true}
                                        onChange={this.onFormChange}
                                        disabled={disableForm}
                                    />
                                </div>
                            </div>
                            <div className="mx_E2eKeysDialog_inputRow">
                                <Field
                                    label={_t("settings|key_export_import|enter_passphrase")}
                                    value={this.state.passphrase}
                                    onChange={this.onPassphraseChange}
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
                            value={_t("action|import")}
                            disabled={!this.state.enableSubmit || disableForm}
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
