/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018-2019 New Vector Ltd

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

import React from "react";
import { MatrixClient } from "matrix-js-sdk/src/client";

import type ExportE2eKeysDialog from "../../../async-components/views/dialogs/security/ExportE2eKeysDialog";
import Field from "../elements/Field";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import AccessibleButton from "../elements/AccessibleButton";
import Spinner from "../elements/Spinner";
import withValidation, { IFieldState, IValidationResult } from "../elements/Validation";
import { UserFriendlyError, _t, _td } from "../../../languageHandler";
import Modal from "../../../Modal";
import PassphraseField from "../auth/PassphraseField";
import { PASSWORD_MIN_SCORE } from "../auth/RegistrationForm";
import SetEmailDialog from "../dialogs/SetEmailDialog";
import QuestionDialog from "../dialogs/QuestionDialog";

const FIELD_OLD_PASSWORD = "field_old_password";
const FIELD_NEW_PASSWORD = "field_new_password";
const FIELD_NEW_PASSWORD_CONFIRM = "field_new_password_confirm";
type FieldType = typeof FIELD_OLD_PASSWORD | typeof FIELD_NEW_PASSWORD | typeof FIELD_NEW_PASSWORD_CONFIRM;

enum Phase {
    Edit = "edit",
    Uploading = "uploading",
    Error = "error",
}

interface IProps {
    onFinished: (outcome: {
        didSetEmail?: boolean;
        /** Was one or more other devices logged out whilst changing the password */
        didLogoutOutOtherDevices: boolean;
    }) => void;
    onError: (error: Error) => void;
    rowClassName?: string;
    buttonClassName?: string;
    buttonKind?: string;
    buttonLabel?: string;
    confirm?: boolean;
    // Whether to autoFocus the new password input
    autoFocusNewPasswordInput?: boolean;
    className?: string;
    shouldAskForEmail?: boolean;
}

interface IState {
    fieldValid: Partial<Record<FieldType, boolean>>;
    phase: Phase;
    oldPassword: string;
    newPassword: string;
    newPasswordConfirm: string;
}

export default class ChangePassword extends React.Component<IProps, IState> {
    private [FIELD_OLD_PASSWORD]: Field | null = null;
    private [FIELD_NEW_PASSWORD]: Field | null = null;
    private [FIELD_NEW_PASSWORD_CONFIRM]: Field | null = null;

    public static defaultProps: Partial<IProps> = {
        onFinished() {},
        onError() {},

        confirm: true,
    };

    public constructor(props: IProps) {
        super(props);

        this.state = {
            fieldValid: {},
            phase: Phase.Edit,
            oldPassword: "",
            newPassword: "",
            newPasswordConfirm: "",
        };
    }

    private async onChangePassword(oldPassword: string, newPassword: string): Promise<void> {
        const cli = MatrixClientPeg.get();

        // if the server supports it then don't sign user out of all devices
        const serverSupportsControlOfDevicesLogout = await cli.doesServerSupportLogoutDevices();
        const userHasOtherDevices = (await cli.getDevices()).devices.length > 1;

        if (userHasOtherDevices && !serverSupportsControlOfDevicesLogout && this.props.confirm) {
            // warn about logging out all devices
            const { finished } = Modal.createDialog(QuestionDialog, {
                title: _t("Warning!"),
                description: (
                    <div>
                        <p>
                            {_t(
                                "Changing your password on this homeserver will cause all of your other devices to be " +
                                    "signed out. This will delete the message encryption keys stored on them, and may make " +
                                    "encrypted chat history unreadable.",
                            )}
                        </p>
                        <p>
                            {_t(
                                "If you want to retain access to your chat history in encrypted rooms you should first " +
                                    "export your room keys and re-import them afterwards.",
                            )}
                        </p>
                        <p>
                            {_t(
                                "You can also ask your homeserver admin to upgrade the server to change this behaviour.",
                            )}
                        </p>
                    </div>
                ),
                button: _t("Continue"),
                extraButtons: [
                    <button key="exportRoomKeys" className="mx_Dialog_primary" onClick={this.onExportE2eKeysClicked}>
                        {_t("Export E2E room keys")}
                    </button>,
                ],
            });

            const [confirmed] = await finished;
            if (!confirmed) return;
        }

        this.changePassword(cli, oldPassword, newPassword, serverSupportsControlOfDevicesLogout, userHasOtherDevices);
    }

    private changePassword(
        cli: MatrixClient,
        oldPassword: string,
        newPassword: string,
        serverSupportsControlOfDevicesLogout: boolean,
        userHasOtherDevices: boolean,
    ): void {
        const authDict = {
            type: "m.login.password",
            identifier: {
                type: "m.id.user",
                user: cli.credentials.userId,
            },
            // TODO: Remove `user` once servers support proper UIA
            // See https://github.com/matrix-org/synapse/issues/5665
            user: cli.credentials.userId ?? undefined,
            password: oldPassword,
        };

        this.setState({
            phase: Phase.Uploading,
        });

        const logoutDevices = serverSupportsControlOfDevicesLogout ? false : undefined;

        // undefined or true mean all devices signed out
        const didLogoutOutOtherDevices = !serverSupportsControlOfDevicesLogout && userHasOtherDevices;

        cli.setPassword(authDict, newPassword, logoutDevices)
            .then(
                () => {
                    if (this.props.shouldAskForEmail) {
                        return this.optionallySetEmail().then((confirmed) => {
                            this.props.onFinished({
                                didSetEmail: confirmed,
                                didLogoutOutOtherDevices,
                            });
                        });
                    } else {
                        this.props.onFinished({ didLogoutOutOtherDevices });
                    }
                },
                (err) => {
                    if (err instanceof Error) {
                        this.props.onError(err);
                    } else {
                        this.props.onError(
                            new UserFriendlyError("Error while changing password: %(error)s", {
                                error: String(err),
                                cause: undefined,
                            }),
                        );
                    }
                },
            )
            .finally(() => {
                this.setState({
                    phase: Phase.Edit,
                    oldPassword: "",
                    newPassword: "",
                    newPasswordConfirm: "",
                });
            });
    }

    /**
     * Checks the `newPass` and throws an error if it is unacceptable.
     * @param oldPass The old password
     * @param newPass The new password that the user is trying to be set
     * @param confirmPass The confirmation password where the user types the `newPass`
     * again for confirmation and should match the `newPass` before we accept their new
     * password.
     */
    private checkPassword(oldPass: string, newPass: string, confirmPass: string): void {
        if (newPass !== confirmPass) {
            throw new UserFriendlyError("New passwords don't match");
        } else if (!newPass || newPass.length === 0) {
            throw new UserFriendlyError("Passwords can't be empty");
        }
    }

    private optionallySetEmail(): Promise<boolean> {
        // Ask for an email otherwise the user has no way to reset their password
        const modal = Modal.createDialog(SetEmailDialog, {
            title: _t("Do you want to set an email address?"),
        });
        return modal.finished.then(([confirmed]) => !!confirmed);
    }

    private onExportE2eKeysClicked = (): void => {
        Modal.createDialogAsync(
            import("../../../async-components/views/dialogs/security/ExportE2eKeysDialog") as unknown as Promise<
                typeof ExportE2eKeysDialog
            >,
            {
                matrixClient: MatrixClientPeg.get(),
            },
        );
    };

    private markFieldValid(fieldID: FieldType, valid?: boolean): void {
        const { fieldValid } = this.state;
        fieldValid[fieldID] = valid;
        this.setState({
            fieldValid,
        });
    }

    private onChangeOldPassword = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            oldPassword: ev.target.value,
        });
    };

    private onOldPasswordValidate = async (fieldState: IFieldState): Promise<IValidationResult> => {
        const result = await this.validateOldPasswordRules(fieldState);
        this.markFieldValid(FIELD_OLD_PASSWORD, result.valid);
        return result;
    };

    private validateOldPasswordRules = withValidation({
        rules: [
            {
                key: "required",
                test: ({ value, allowEmpty }) => allowEmpty || !!value,
                invalid: () => _t("Passwords can't be empty"),
            },
        ],
    });

    private onChangeNewPassword = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            newPassword: ev.target.value,
        });
    };

    private onNewPasswordValidate = (result: IValidationResult): void => {
        this.markFieldValid(FIELD_NEW_PASSWORD, result.valid);
    };

    private onChangeNewPasswordConfirm = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            newPasswordConfirm: ev.target.value,
        });
    };

    private onNewPasswordConfirmValidate = async (fieldState: IFieldState): Promise<IValidationResult> => {
        const result = await this.validatePasswordConfirmRules(fieldState);
        this.markFieldValid(FIELD_NEW_PASSWORD_CONFIRM, result.valid);
        return result;
    };

    private validatePasswordConfirmRules = withValidation<this>({
        rules: [
            {
                key: "required",
                test: ({ value, allowEmpty }) => allowEmpty || !!value,
                invalid: () => _t("Confirm password"),
            },
            {
                key: "match",
                test({ value }) {
                    return !value || value === this.state.newPassword;
                },
                invalid: () => _t("Passwords don't match"),
            },
        ],
    });

    private onClickChange = async (ev: React.MouseEvent | React.FormEvent): Promise<void> => {
        ev.preventDefault();

        const allFieldsValid = await this.verifyFieldsBeforeSubmit();
        if (!allFieldsValid) {
            return;
        }

        const oldPassword = this.state.oldPassword;
        const newPassword = this.state.newPassword;
        const confirmPassword = this.state.newPasswordConfirm;
        try {
            // TODO: We can remove this check (but should add some Cypress tests to
            // sanity check this flow). This logic is redundant with the input field
            // validation we do and `verifyFieldsBeforeSubmit()` above. See
            // https://github.com/matrix-org/matrix-react-sdk/pull/10615#discussion_r1167364214
            this.checkPassword(oldPassword, newPassword, confirmPassword);
            return this.onChangePassword(oldPassword, newPassword);
        } catch (err) {
            if (err instanceof Error) {
                this.props.onError(err);
            } else {
                this.props.onError(
                    new UserFriendlyError("Error while changing password: %(error)s", {
                        error: String(err),
                        cause: undefined,
                    }),
                );
            }
        }
    };

    private async verifyFieldsBeforeSubmit(): Promise<boolean> {
        // Blur the active element if any, so we first run its blur validation,
        // which is less strict than the pass we're about to do below for all fields.
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement) {
            activeElement.blur();
        }

        const fieldIDsInDisplayOrder: FieldType[] = [
            FIELD_OLD_PASSWORD,
            FIELD_NEW_PASSWORD,
            FIELD_NEW_PASSWORD_CONFIRM,
        ];

        // Run all fields with stricter validation that no longer allows empty
        // values for required fields.
        for (const fieldID of fieldIDsInDisplayOrder) {
            const field = this[fieldID];
            if (!field) {
                continue;
            }
            // We must wait for these validations to finish before queueing
            // up the setState below so our setState goes in the queue after
            // all the setStates from these validate calls (that's how we
            // know they've finished).
            await field.validate({ allowEmpty: false });
        }

        // Validation and state updates are async, so we need to wait for them to complete
        // first. Queue a `setState` callback and wait for it to resolve.
        await new Promise<void>((resolve) => this.setState({}, resolve));

        if (this.allFieldsValid()) {
            return true;
        }

        const invalidField = this.findFirstInvalidField(fieldIDsInDisplayOrder);

        if (!invalidField) {
            return true;
        }

        // Focus the first invalid field and show feedback in the stricter mode
        // that no longer allows empty values for required fields.
        invalidField.focus();
        invalidField.validate({ allowEmpty: false, focused: true });
        return false;
    }

    private allFieldsValid(): boolean {
        return Object.values(this.state.fieldValid).every(Boolean);
    }

    private findFirstInvalidField(fieldIDs: FieldType[]): Field | null {
        for (const fieldID of fieldIDs) {
            if (!this.state.fieldValid[fieldID] && this[fieldID]) {
                return this[fieldID];
            }
        }
        return null;
    }

    public render(): React.ReactNode {
        const rowClassName = this.props.rowClassName;
        const buttonClassName = this.props.buttonClassName;

        switch (this.state.phase) {
            case Phase.Edit:
                return (
                    <form className={this.props.className} onSubmit={this.onClickChange}>
                        <div className={rowClassName}>
                            <Field
                                ref={(field) => (this[FIELD_OLD_PASSWORD] = field)}
                                type="password"
                                label={_t("Current password")}
                                value={this.state.oldPassword}
                                onChange={this.onChangeOldPassword}
                                onValidate={this.onOldPasswordValidate}
                            />
                        </div>
                        <div className={rowClassName}>
                            <PassphraseField
                                fieldRef={(field) => (this[FIELD_NEW_PASSWORD] = field)}
                                type="password"
                                label={_td("New Password")}
                                minScore={PASSWORD_MIN_SCORE}
                                value={this.state.newPassword}
                                autoFocus={this.props.autoFocusNewPasswordInput}
                                onChange={this.onChangeNewPassword}
                                onValidate={this.onNewPasswordValidate}
                                autoComplete="new-password"
                            />
                        </div>
                        <div className={rowClassName}>
                            <Field
                                ref={(field) => (this[FIELD_NEW_PASSWORD_CONFIRM] = field)}
                                type="password"
                                label={_t("Confirm password")}
                                value={this.state.newPasswordConfirm}
                                onChange={this.onChangeNewPasswordConfirm}
                                onValidate={this.onNewPasswordConfirmValidate}
                                autoComplete="new-password"
                            />
                        </div>
                        <AccessibleButton
                            className={buttonClassName}
                            kind={this.props.buttonKind}
                            onClick={this.onClickChange}
                        >
                            {this.props.buttonLabel || _t("Change Password")}
                        </AccessibleButton>
                    </form>
                );
            case Phase.Uploading:
                return (
                    <div className="mx_Dialog_content">
                        <Spinner />
                    </div>
                );
        }
    }
}
