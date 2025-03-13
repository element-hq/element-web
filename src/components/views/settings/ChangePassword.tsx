/*
Copyright 2018-2024 New Vector Ltd.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import Field from "../elements/Field";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import AccessibleButton, { type AccessibleButtonKind } from "../elements/AccessibleButton";
import Spinner from "../elements/Spinner";
import withValidation, { type IFieldState, type IValidationResult } from "../elements/Validation";
import { UserFriendlyError, _t, _td } from "../../../languageHandler";
import Modal from "../../../Modal";
import PassphraseField from "../auth/PassphraseField";
import { PASSWORD_MIN_SCORE } from "../auth/RegistrationForm";
import SetEmailDialog from "../dialogs/SetEmailDialog";

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
    onFinished: (outcome: { didSetEmail?: boolean }) => void;
    onError: (error: Error) => void;
    rowClassName?: string;
    buttonClassName?: string;
    buttonKind?: AccessibleButtonKind;
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
        const cli = MatrixClientPeg.safeGet();

        this.changePassword(cli, oldPassword, newPassword);
    }

    private changePassword(cli: MatrixClient, oldPassword: string, newPassword: string): void {
        const authDict = {
            type: "m.login.password",
            identifier: {
                type: "m.id.user",
                user: cli.credentials.userId,
            },
            password: oldPassword,
        };

        this.setState({
            phase: Phase.Uploading,
        });

        cli.setPassword(authDict, newPassword, false)
            .then(
                () => {
                    if (this.props.shouldAskForEmail) {
                        return this.optionallySetEmail().then((confirmed) => {
                            this.props.onFinished({
                                didSetEmail: confirmed,
                            });
                        });
                    } else {
                        this.props.onFinished({});
                    }
                },
                (err) => {
                    if (err instanceof Error) {
                        this.props.onError(err);
                    } else {
                        this.props.onError(
                            new UserFriendlyError("auth|change_password_error", {
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
            throw new UserFriendlyError("auth|change_password_mismatch");
        } else if (!newPass || newPass.length === 0) {
            throw new UserFriendlyError("auth|change_password_empty");
        }
    }

    private optionallySetEmail(): Promise<boolean> {
        // Ask for an email otherwise the user has no way to reset their password
        const modal = Modal.createDialog(SetEmailDialog, {
            title: _t("auth|set_email_prompt"),
        });
        return modal.finished.then(([confirmed]) => !!confirmed);
    }

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
                invalid: () => _t("auth|change_password_empty"),
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
                invalid: () => _t("auth|change_password_confirm_label"),
            },
            {
                key: "match",
                test({ value }) {
                    return !value || value === this.state.newPassword;
                },
                invalid: () => _t("auth|change_password_confirm_invalid"),
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
            // TODO: We can remove this check (but should add some Playwright tests to
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
                    new UserFriendlyError("auth|change_password_error", {
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
                                label={_t("auth|change_password_current_label")}
                                value={this.state.oldPassword}
                                onChange={this.onChangeOldPassword}
                                onValidate={this.onOldPasswordValidate}
                            />
                        </div>
                        <div className={rowClassName}>
                            <PassphraseField
                                fieldRef={(field) => (this[FIELD_NEW_PASSWORD] = field)}
                                type="password"
                                label={_td("auth|change_password_new_label")}
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
                                label={_t("auth|change_password_confirm_label")}
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
                            {this.props.buttonLabel || _t("auth|change_password_action")}
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
