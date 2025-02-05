/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef, type KeyboardEventHandler } from "react";
import { MatrixError } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import withValidation, { type IFieldState, type IValidationResult } from "./Validation";
import Field, { type IValidateOpts } from "./Field";
import MatrixClientContext from "../../../contexts/MatrixClientContext";

interface IProps {
    domain?: string;
    value: string;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    // if roomId is passed then the entered alias is checked to point to this roomId, else must be unassigned
    roomId?: string;
    onKeyDown?: KeyboardEventHandler;
    onChange?(value: string): void;
}

interface IState {
    isValid: boolean;
}

// Controlled form component wrapping Field for inputting a room alias scoped to a given domain
export default class RoomAliasField extends React.PureComponent<IProps, IState> {
    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    private fieldRef = createRef<Field>();

    public constructor(props: IProps, context: React.ContextType<typeof MatrixClientContext>) {
        super(props, context);

        this.state = {
            isValid: true,
        };
    }

    private asFullAlias(localpart: string): string {
        const hashAlias = `#${localpart}`;
        if (this.props.domain) {
            return `${hashAlias}:${this.props.domain}`;
        }
        return hashAlias;
    }

    private get domainProps(): {
        prefix: JSX.Element;
        postfix: JSX.Element;
        value: string;
        maxlength: number;
    } {
        const { domain } = this.props;
        const prefix = <span>#</span>;
        const postfix = domain ? <span title={`:${domain}`}>{`:${domain}`}</span> : <span />;
        const maxlength = domain ? 255 - domain.length - 2 : 255 - 1; // 2 for # and :
        const value = domain
            ? this.props.value.substring(1, this.props.value.length - domain.length - 1)
            : this.props.value.substring(1);

        return { prefix, postfix, value, maxlength };
    }

    public render(): React.ReactNode {
        const { prefix, postfix, value, maxlength } = this.domainProps;
        return (
            <Field
                label={this.props.label || _t("room_settings|general|alias_heading")}
                className="mx_RoomAliasField"
                prefixComponent={prefix}
                postfixComponent={postfix}
                ref={this.fieldRef}
                onValidate={this.onValidate}
                placeholder={this.props.placeholder || _t("room_settings|general|alias_field_placeholder_default")}
                onChange={this.onChange}
                value={value}
                maxLength={maxlength}
                disabled={this.props.disabled}
                autoComplete="off"
                onKeyDown={this.props.onKeyDown}
            />
        );
    }

    private onChange = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        this.props.onChange?.(this.asFullAlias(ev.target.value));
    };

    private onValidate = async (fieldState: IFieldState): Promise<IValidationResult> => {
        const result = await this.validationRules(fieldState);
        this.setState({ isValid: !!result.valid });
        return result;
    };

    private validationRules = withValidation({
        rules: [
            {
                key: "hasDomain",
                test: async ({ value }): Promise<boolean> => {
                    // Ignore if we have passed domain
                    if (!value || this.props.domain) {
                        return true;
                    }

                    if (value.split(":").length < 2) {
                        return false;
                    }
                    return true;
                },
                invalid: () => _t("room_settings|general|alias_field_has_domain_invalid"),
            },
            {
                key: "hasLocalpart",
                test: async ({ value }): Promise<boolean> => {
                    if (!value || this.props.domain) {
                        return true;
                    }

                    const split = value.split(":");
                    if (split.length < 2) {
                        return true; // hasDomain check will fail here instead
                    }

                    // Define the value invalid if there's no first part (roomname)
                    if (split[0].length < 1) {
                        return false;
                    }
                    return true;
                },
                invalid: () => _t("room_settings|general|alias_field_has_localpart_invalid"),
            },
            {
                key: "safeLocalpart",
                test: async ({ value }): Promise<boolean> => {
                    if (!value) {
                        return true;
                    }
                    if (!this.props.domain) {
                        return true;
                    } else {
                        const fullAlias = this.asFullAlias(value);
                        const hasColon = this.props.domain ? !value.includes(":") : true;
                        // XXX: FIXME https://github.com/matrix-org/matrix-doc/issues/668
                        // NOTE: We could probably use linkifyjs to parse those aliases here?
                        return (
                            !value.includes("#") &&
                            hasColon &&
                            !value.includes(",") &&
                            encodeURI(fullAlias) === fullAlias
                        );
                    }
                },
                invalid: () => _t("room_settings|general|alias_field_safe_localpart_invalid"),
            },
            {
                key: "required",
                test: async ({ value, allowEmpty }) => allowEmpty || !!value,
                invalid: () => _t("room_settings|general|alias_field_required_invalid"),
            },
            this.props.roomId
                ? {
                      key: "matches",
                      final: true,
                      test: async ({ value }): Promise<boolean> => {
                          if (!value) {
                              return true;
                          }
                          const client = this.context;
                          try {
                              const result = await client.getRoomIdForAlias(this.asFullAlias(value));
                              return result.room_id === this.props.roomId;
                          } catch (err) {
                              console.log(err);
                              return false;
                          }
                      },
                      invalid: () => _t("room_settings|general|alias_field_matches_invalid"),
                  }
                : {
                      key: "taken",
                      final: true,
                      test: async ({ value }): Promise<boolean> => {
                          if (!value) {
                              return true;
                          }
                          const client = this.context;
                          try {
                              await client.getRoomIdForAlias(this.asFullAlias(value));
                              // we got a room id, so the alias is taken
                              return false;
                          } catch (err) {
                              console.log(err);
                              // any server error code will do,
                              // either it M_NOT_FOUND or the alias is invalid somehow,
                              // in which case we don't want to show the invalid message
                              return err instanceof MatrixError;
                          }
                      },
                      valid: () => _t("room_settings|general|alias_field_taken_valid"),
                      invalid: () =>
                          this.props.domain
                              ? _t("room_settings|general|alias_field_taken_invalid_domain")
                              : _t("room_settings|general|alias_field_taken_invalid"),
                  },
        ],
    });

    public get isValid(): boolean {
        return this.state.isValid;
    }

    public async validate(options: IValidateOpts): Promise<boolean> {
        const val = await this.fieldRef.current?.validate(options);
        return val ?? false;
    }

    public focus(): void {
        this.fieldRef.current?.focus();
    }
}
