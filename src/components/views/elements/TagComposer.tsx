/*
Copyright 2024 New Vector Ltd.
Copyright 2021-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { type ChangeEvent, type FormEvent } from "react";

import Field from "./Field";
import { _t } from "../../../languageHandler";
import AccessibleButton from "./AccessibleButton";
import { Tag } from "./Tag";

interface IProps {
    id?: string;
    tags: string[];
    onAdd: (tag: string) => void;
    onRemove: (tag: string) => void;
    disabled?: boolean;
    label?: string;
    placeholder?: string;
}

interface IState {
    newTag: string;
}

/**
 * A simple, controlled, composer for entering string tags. Contains a simple
 * input, add button, and per-tag remove button.
 */
export default class TagComposer extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            newTag: "",
        };
    }

    private onInputChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        this.setState({ newTag: ev.target.value });
    };

    private onAdd = (ev: FormEvent): void => {
        ev.preventDefault();
        if (!this.state.newTag) return;

        this.props.onAdd(this.state.newTag);
        this.setState({ newTag: "" });
    };

    private onRemove(tag: string): void {
        // We probably don't need to proxy this, but for
        // sanity of `this` we'll do so anyways.
        this.props.onRemove(tag);
    }

    public render(): React.ReactNode {
        return (
            <div
                className={classNames("mx_TagComposer", {
                    mx_TagComposer_disabled: this.props.disabled,
                })}
            >
                <form className="mx_TagComposer_input" onSubmit={this.onAdd}>
                    <Field
                        id={this.props.id ? this.props.id + "_field" : undefined}
                        value={this.state.newTag}
                        onChange={this.onInputChange}
                        label={this.props.label || _t("notifications|keyword")}
                        placeholder={this.props.placeholder || _t("notifications|keyword_new")}
                        disabled={this.props.disabled}
                        autoComplete="off"
                    />
                    <AccessibleButton onClick={this.onAdd} kind="primary" disabled={this.props.disabled}>
                        {_t("action|add")}
                    </AccessibleButton>
                </form>
                <div className="mx_TagComposer_tags" role="list">
                    {this.props.tags.map((t, i) => (
                        <Tag
                            label={t}
                            key={t}
                            onDeleteClick={this.onRemove.bind(this, t)}
                            disabled={this.props.disabled}
                            role="listitem"
                        />
                    ))}
                </div>
            </div>
        );
    }
}
