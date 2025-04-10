/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    type JSX,
    type ToggleEvent,
    type ChangeEvent,
    type ContextType,
    createRef,
    type SyntheticEvent,
} from "react";
import { type MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { type RoomCanonicalAliasEventContent } from "matrix-js-sdk/src/types";

import EditableItemList from "../elements/EditableItemList";
import { _t } from "../../../languageHandler";
import Field from "../elements/Field";
import Spinner from "../elements/Spinner";
import ErrorDialog from "../dialogs/ErrorDialog";
import AccessibleButton from "../elements/AccessibleButton";
import Modal from "../../../Modal";
import RoomPublishSetting from "./RoomPublishSetting";
import RoomAliasField from "../elements/RoomAliasField";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import SettingsFieldset from "../settings/SettingsFieldset";

interface IEditableAliasesListProps {
    roomId?: string;
    domain?: string;
}

class EditableAliasesList extends EditableItemList<IEditableAliasesListProps> {
    private aliasField = createRef<RoomAliasField>();

    private onAliasAdded = async (ev: SyntheticEvent): Promise<void> => {
        ev.preventDefault();

        if (!this.aliasField.current) return;
        await this.aliasField.current.validate({ allowEmpty: false });

        if (this.aliasField.current.isValid) {
            if (this.props.onItemAdded) this.props.onItemAdded(this.props.newItem);
            return;
        }

        this.aliasField.current.focus();
        this.aliasField.current.validate({ allowEmpty: false, focused: true });
    };

    protected renderNewItemField(): JSX.Element {
        const onChange = (alias: string): void => this.props.onNewItemChanged?.(alias);
        return (
            <form
                onSubmit={this.onAliasAdded}
                autoComplete="off"
                noValidate={true}
                className="mx_EditableItemList_newItem"
            >
                <RoomAliasField
                    ref={this.aliasField}
                    onChange={onChange}
                    value={this.props.newItem || ""}
                    domain={this.props.domain}
                    roomId={this.props.roomId}
                />
                <AccessibleButton onClick={this.onAliasAdded} kind="primary">
                    {_t("action|add")}
                </AccessibleButton>
            </form>
        );
    }
}

interface IProps {
    roomId: string;
    canSetCanonicalAlias: boolean;
    canSetAliases: boolean;
    canonicalAliasEvent?: MatrixEvent;
    hidePublishSetting?: boolean;
}

interface IState {
    // [ #alias:domain.tld, ... ]
    altAliases: string[];
    // [ #alias:my-hs.tld, ... ]
    localAliases: string[];
    // #canonical:domain.tld
    canonicalAlias: string | null;
    updatingCanonicalAlias: boolean;
    localAliasesLoading: boolean;
    detailsOpen: boolean;
    newAlias?: string;
    newAltAlias?: string;
}

export default class AliasSettings extends React.Component<IProps, IState> {
    public static contextType = MatrixClientContext;
    declare public context: ContextType<typeof MatrixClientContext>;

    public static defaultProps = {
        canSetAliases: false,
        canSetCanonicalAlias: false,
    };

    public constructor(props: IProps) {
        super(props);

        const state: IState = {
            altAliases: [],
            localAliases: [],
            canonicalAlias: null,
            updatingCanonicalAlias: false,
            localAliasesLoading: false,
            detailsOpen: false,
        };

        if (props.canonicalAliasEvent) {
            const content = props.canonicalAliasEvent.getContent();
            const altAliases = content.alt_aliases;
            if (Array.isArray(altAliases)) {
                state.altAliases = altAliases.slice();
            }
            state.canonicalAlias = content.alias;
        }

        this.state = state;
    }

    public componentDidMount(): void {
        if (this.props.canSetCanonicalAlias) {
            // load local aliases for providing recommendations
            // for the canonical alias and alt_aliases
            this.loadLocalAliases();
        }
    }

    private async loadLocalAliases(): Promise<void> {
        this.setState({ localAliasesLoading: true });
        try {
            const mxClient = this.context;

            let localAliases: string[] = [];
            const response = await mxClient.getLocalAliases(this.props.roomId);
            if (Array.isArray(response?.aliases)) {
                localAliases = response.aliases;
            }
            this.setState({ localAliases });

            if (localAliases.length === 0) {
                this.setState({ detailsOpen: true });
            }
        } finally {
            this.setState({ localAliasesLoading: false });
        }
    }

    private changeCanonicalAlias(alias: string | null): void {
        if (!this.props.canSetCanonicalAlias) return;

        const oldAlias = this.state.canonicalAlias;
        this.setState({
            canonicalAlias: alias,
            updatingCanonicalAlias: true,
        });

        const eventContent: RoomCanonicalAliasEventContent = {
            alt_aliases: this.state.altAliases,
        };

        if (alias) eventContent["alias"] = alias;

        this.context
            .sendStateEvent(this.props.roomId, EventType.RoomCanonicalAlias, eventContent, "")
            .catch((err) => {
                logger.error(err);
                Modal.createDialog(ErrorDialog, {
                    title: _t("room_settings|general|error_updating_canonical_alias_title"),
                    description: _t("room_settings|general|error_updating_canonical_alias_description"),
                });
                this.setState({ canonicalAlias: oldAlias });
            })
            .finally(() => {
                this.setState({ updatingCanonicalAlias: false });
            });
    }

    private changeAltAliases(altAliases: string[]): void {
        if (!this.props.canSetCanonicalAlias) return;

        this.setState({
            updatingCanonicalAlias: true,
        });

        const eventContent: RoomCanonicalAliasEventContent = {};

        if (this.state.canonicalAlias) {
            eventContent["alias"] = this.state.canonicalAlias;
        }
        if (altAliases) {
            eventContent["alt_aliases"] = altAliases;
        }

        this.context
            .sendStateEvent(this.props.roomId, EventType.RoomCanonicalAlias, eventContent, "")
            .then(() => {
                this.setState({
                    altAliases,
                });
            })
            .catch((err) => {
                // TODO: Add error handling based upon server validation
                logger.error(err);
                Modal.createDialog(ErrorDialog, {
                    title: _t("room_settings|general|error_updating_canonical_alias_title"),
                    description: _t("room_settings|general|error_updating_alias_description"),
                });
            })
            .finally(() => {
                this.setState({ updatingCanonicalAlias: false });
            });
    }

    private onNewAliasChanged = (value: string): void => {
        this.setState({ newAlias: value });
    };

    private onLocalAliasAdded = (alias?: string): void => {
        if (!alias || alias.length === 0) return; // ignore attempts to create blank aliases

        const localDomain = this.context.getDomain();
        if (!alias.includes(":")) alias += ":" + localDomain;

        this.context
            .createAlias(alias, this.props.roomId)
            .then(() => {
                this.setState({
                    localAliases: this.state.localAliases.concat(alias!),
                    newAlias: undefined,
                });
                if (!this.state.canonicalAlias) {
                    this.changeCanonicalAlias(alias!);
                }
            })
            .catch((err) => {
                logger.error(err);
                Modal.createDialog(ErrorDialog, {
                    title: _t("room_settings|general|error_creating_alias_title"),
                    description: _t("room_settings|general|error_creating_alias_description"),
                });
            });
    };

    private onLocalAliasDeleted = (index: number): void => {
        const alias = this.state.localAliases[index];
        // TODO: In future, we should probably be making sure that the alias actually belongs
        // to this room. See https://github.com/vector-im/element-web/issues/7353
        this.context
            .deleteAlias(alias)
            .then(() => {
                const localAliases = this.state.localAliases.filter((a) => a !== alias);
                this.setState({ localAliases });

                if (this.state.canonicalAlias === alias) {
                    this.changeCanonicalAlias(null);
                }
            })
            .catch((err) => {
                logger.error(err);
                let description;
                if (err.errcode === "M_FORBIDDEN") {
                    description = _t("room_settings|general|error_deleting_alias_description_forbidden");
                } else {
                    description = _t("room_settings|general|error_deleting_alias_description");
                }
                Modal.createDialog(ErrorDialog, {
                    title: _t("room_settings|general|error_deleting_alias_title"),
                    description,
                });
            });
    };

    private onLocalAliasesToggled = (event: ToggleEvent<HTMLDetailsElement>): void => {
        // expanded
        if (event.currentTarget.open) {
            // if local aliases haven't been preloaded yet at component mount
            if (!this.props.canSetCanonicalAlias && this.state.localAliases.length === 0) {
                this.loadLocalAliases();
            }
        }
        this.setState({ detailsOpen: event.currentTarget.open });
    };

    private onCanonicalAliasChange = (event: ChangeEvent<HTMLSelectElement>): void => {
        this.changeCanonicalAlias(event.target.value);
    };

    private onNewAltAliasChanged = (value: string): void => {
        this.setState({ newAltAlias: value });
    };

    private onAltAliasAdded = (alias: string): void => {
        const altAliases = this.state.altAliases.slice();
        if (!altAliases.some((a) => a.trim() === alias.trim())) {
            altAliases.push(alias.trim());
            this.changeAltAliases(altAliases);
            this.setState({ newAltAlias: "" });
        }
    };

    private onAltAliasDeleted = (index: number): void => {
        const altAliases = this.state.altAliases.slice();
        altAliases.splice(index, 1);
        this.changeAltAliases(altAliases);
    };

    private getAliases(): string[] {
        return this.state.altAliases.concat(this.getLocalNonAltAliases());
    }

    private getLocalNonAltAliases(): string[] {
        const { altAliases } = this.state;
        return this.state.localAliases.filter((alias) => !altAliases.includes(alias));
    }

    public render(): React.ReactNode {
        const mxClient = this.context;
        const localDomain = mxClient.getDomain()!;
        const isSpaceRoom = mxClient.getRoom(this.props.roomId)?.isSpaceRoom();

        let found = false;
        const canonicalValue = this.state.canonicalAlias || "";
        const canonicalAliasSection = (
            <Field
                onChange={this.onCanonicalAliasChange}
                value={canonicalValue}
                disabled={this.state.updatingCanonicalAlias || !this.props.canSetCanonicalAlias}
                element="select"
                id="canonicalAlias"
                label={_t("room_settings|general|canonical_alias_field_label")}
            >
                <option value="" key="unset">
                    {_t("room_settings|alias_not_specified")}
                </option>
                {this.getAliases().map((alias, i) => {
                    if (alias === this.state.canonicalAlias) found = true;
                    return (
                        <option value={alias} key={i}>
                            {alias}
                        </option>
                    );
                })}
                {found || !this.state.canonicalAlias ? (
                    ""
                ) : (
                    <option value={this.state.canonicalAlias} key="arbitrary">
                        {this.state.canonicalAlias}
                    </option>
                )}
            </Field>
        );

        let localAliasesList: JSX.Element;
        if (this.state.localAliasesLoading) {
            localAliasesList = <Spinner />;
        } else {
            localAliasesList = (
                <EditableAliasesList
                    id="roomAliases"
                    items={this.state.localAliases}
                    newItem={this.state.newAlias}
                    onNewItemChanged={this.onNewAliasChanged}
                    canRemove={this.props.canSetAliases}
                    canEdit={this.props.canSetAliases}
                    onItemAdded={this.onLocalAliasAdded}
                    onItemRemoved={this.onLocalAliasDeleted}
                    noItemsLabel={
                        isSpaceRoom
                            ? _t("room_settings|general|no_aliases_space")
                            : _t("room_settings|general|no_aliases_room")
                    }
                    placeholder={_t("room_settings|general|local_alias_field_label")}
                    domain={localDomain}
                />
            );
        }

        return (
            <>
                <SettingsFieldset
                    data-testid="published-address-fieldset"
                    legend={_t("room_settings|general|published_aliases_section")}
                    description={
                        <>
                            {isSpaceRoom
                                ? _t("room_settings|general|published_aliases_explainer_space")
                                : _t("room_settings|general|published_aliases_explainer_room")}
                            &nbsp;
                            {_t("room_settings|general|published_aliases_description")}
                        </>
                    }
                >
                    {canonicalAliasSection}
                    {this.props.hidePublishSetting ? null : (
                        <RoomPublishSetting
                            roomId={this.props.roomId}
                            canSetCanonicalAlias={this.props.canSetCanonicalAlias}
                        />
                    )}
                    <datalist id="mx_AliasSettings_altRecommendations">
                        {this.getLocalNonAltAliases().map((alias) => {
                            return <option value={alias} key={alias} />;
                        })}
                        ;
                    </datalist>
                    <EditableAliasesList
                        id="roomAltAliases"
                        items={this.state.altAliases}
                        newItem={this.state.newAltAlias}
                        onNewItemChanged={this.onNewAltAliasChanged}
                        canRemove={this.props.canSetCanonicalAlias}
                        canEdit={this.props.canSetCanonicalAlias}
                        onItemAdded={this.onAltAliasAdded}
                        onItemRemoved={this.onAltAliasDeleted}
                        suggestionsListId="mx_AliasSettings_altRecommendations"
                        itemsLabel={_t("room_settings|general|aliases_items_label")}
                        noItemsLabel={_t("room_settings|general|aliases_no_items_label")}
                        placeholder={_t("room_settings|general|new_alias_placeholder")}
                        roomId={this.props.roomId}
                    />
                </SettingsFieldset>
                <SettingsFieldset
                    data-testid="local-address-fieldset"
                    legend={_t("room_settings|general|local_aliases_section")}
                    description={
                        isSpaceRoom
                            ? _t("room_settings|general|local_aliases_explainer_space", { localDomain })
                            : _t("room_settings|general|local_aliases_explainer_room", { localDomain })
                    }
                >
                    <details onToggle={this.onLocalAliasesToggled} open={this.state.detailsOpen}>
                        <summary className="mx_AliasSettings_localAddresses">
                            {this.state.detailsOpen ? _t("room_list|show_less") : _t("common|show_more")}
                        </summary>
                        {localAliasesList}
                    </details>
                </SettingsFieldset>
            </>
        );
    }
}
