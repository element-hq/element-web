/*
Copyright 2016 - 2023 The Matrix.org Foundation C.I.C.

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

import React, { ChangeEvent, ContextType, createRef, SyntheticEvent } from "react";
import { IContent, MatrixEvent } from "matrix-js-sdk/src/models/event";
import { logger } from "matrix-js-sdk/src/logger";
import { EventType } from "matrix-js-sdk/src/@types/event";

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
                    {_t("Add")}
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
    public context!: ContextType<typeof MatrixClientContext>;

    public static defaultProps = {
        canSetAliases: false,
        canSetCanonicalAlias: false,
    };

    public constructor(props: IProps, context: ContextType<typeof MatrixClientContext>) {
        super(props, context);

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

        const eventContent: IContent = {
            alt_aliases: this.state.altAliases,
        };

        if (alias) eventContent["alias"] = alias;

        this.context
            .sendStateEvent(this.props.roomId, EventType.RoomCanonicalAlias, eventContent, "")
            .catch((err) => {
                logger.error(err);
                Modal.createDialog(ErrorDialog, {
                    title: _t("Error updating main address"),
                    description: _t(
                        "There was an error updating the room's main address. It may not be allowed by the server " +
                            "or a temporary failure occurred.",
                    ),
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

        const eventContent: IContent = {};

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
                    title: _t("Error updating main address"),
                    description: _t(
                        "There was an error updating the room's alternative addresses. " +
                            "It may not be allowed by the server or a temporary failure occurred.",
                    ),
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
                    title: _t("Error creating address"),
                    description: _t(
                        "There was an error creating that address. It may not be allowed by the server " +
                            "or a temporary failure occurred.",
                    ),
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
                    description = _t("You don't have permission to delete the address.");
                } else {
                    description = _t(
                        "There was an error removing that address. It may no longer exist or a temporary " +
                            "error occurred.",
                    );
                }
                Modal.createDialog(ErrorDialog, {
                    title: _t("Error removing address"),
                    description,
                });
            });
    };

    private onLocalAliasesToggled = (event: ChangeEvent<HTMLDetailsElement>): void => {
        // expanded
        if (event.target.open) {
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
                label={_t("Main address")}
            >
                <option value="" key="unset">
                    {_t("not specified")}
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
                        isSpaceRoom ? _t("This space has no local addresses") : _t("This room has no local addresses")
                    }
                    placeholder={_t("Local address")}
                    domain={localDomain}
                />
            );
        }

        return (
            <>
                <SettingsFieldset
                    data-testid="published-address-fieldset"
                    legend={_t("Published Addresses")}
                    description={
                        <>
                            {isSpaceRoom
                                ? _t("Published addresses can be used by anyone on any server to join your space.")
                                : _t("Published addresses can be used by anyone on any server to join your room.")}
                            &nbsp;
                            {_t("To publish an address, it needs to be set as a local address first.")}
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
                        itemsLabel={_t("Other published addresses:")}
                        noItemsLabel={_t("No other published addresses yet, add one below")}
                        placeholder={_t("New published address (e.g. #alias:server)")}
                        roomId={this.props.roomId}
                    />
                </SettingsFieldset>
                <SettingsFieldset
                    data-testid="local-address-fieldset"
                    legend={_t("Local Addresses")}
                    description={
                        isSpaceRoom
                            ? _t(
                                  "Set addresses for this space so users can find this space " +
                                      "through your homeserver (%(localDomain)s)",
                                  { localDomain },
                              )
                            : _t(
                                  "Set addresses for this room so users can find this room " +
                                      "through your homeserver (%(localDomain)s)",
                                  { localDomain },
                              )
                    }
                >
                    <details onToggle={this.onLocalAliasesToggled} open={this.state.detailsOpen}>
                        <summary className="mx_AliasSettings_localAddresses">
                            {this.state.detailsOpen ? _t("Show less") : _t("Show more")}
                        </summary>
                        {localAliasesList}
                    </details>
                </SettingsFieldset>
            </>
        );
    }
}
