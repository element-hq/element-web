/*
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2015 - 2021 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import { Direction } from 'matrix-js-sdk/src/models/event-timeline';
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from '../../../languageHandler';
import { formatFullDateNoTime } from '../../../DateUtils';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import dis from '../../../dispatcher/dispatcher';
import { Action } from '../../../dispatcher/actions';
import SettingsStore from '../../../settings/SettingsStore';
import { UIFeature } from '../../../settings/UIFeature';
import Modal from '../../../Modal';
import ErrorDialog from '../dialogs/ErrorDialog';
import { contextMenuBelow } from '../rooms/RoomTile';
import { ContextMenuTooltipButton } from "../../structures/ContextMenu";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import JumpToDatePicker from './JumpToDatePicker';
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";

function getDaysArray(): string[] {
    return [
        _t('Sunday'),
        _t('Monday'),
        _t('Tuesday'),
        _t('Wednesday'),
        _t('Thursday'),
        _t('Friday'),
        _t('Saturday'),
    ];
}

interface IProps {
    roomId: string;
    ts: number;
    forExport?: boolean;
}

interface IState {
    contextMenuPosition?: DOMRect;
    jumpToDateEnabled: boolean;
}

export default class DateSeparator extends React.Component<IProps, IState> {
    private settingWatcherRef = null;

    constructor(props, context) {
        super(props, context);
        this.state = {
            jumpToDateEnabled: SettingsStore.getValue("feature_jump_to_date"),
        };

        // We're using a watcher so the date headers in the timeline are updated
        // when the lab setting is toggled.
        this.settingWatcherRef = SettingsStore.watchSetting(
            "feature_jump_to_date",
            null,
            (settingName, roomId, level, newValAtLevel, newVal) => {
                this.setState({ jumpToDateEnabled: newVal });
            },
        );
    }

    componentWillUnmount() {
        SettingsStore.unwatchSetting(this.settingWatcherRef);
    }

    private onContextMenuOpenClick = (e: React.MouseEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target as HTMLButtonElement;
        this.setState({ contextMenuPosition: target.getBoundingClientRect() });
    };

    private onContextMenuCloseClick = (): void => {
        this.closeMenu();
    };

    private closeMenu = (): void => {
        this.setState({
            contextMenuPosition: null,
        });
    };

    private getLabel(): string {
        const date = new Date(this.props.ts);
        const disableRelativeTimestamps = !SettingsStore.getValue(UIFeature.TimelineEnableRelativeDates);

        // During the time the archive is being viewed, a specific day might not make sense, so we return the full date
        if (this.props.forExport || disableRelativeTimestamps) return formatFullDateNoTime(date);

        const today = new Date();
        const yesterday = new Date();
        const days = getDaysArray();
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return _t('Today');
        } else if (date.toDateString() === yesterday.toDateString()) {
            return _t('Yesterday');
        } else if (today.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000) {
            return days[date.getDay()];
        } else {
            return formatFullDateNoTime(date);
        }
    }

    private pickDate = async (inputTimestamp): Promise<void> => {
        const unixTimestamp = new Date(inputTimestamp).getTime();

        const cli = MatrixClientPeg.get();
        try {
            const roomId = this.props.roomId;
            const { event_id: eventId, origin_server_ts: originServerTs } = await cli.timestampToEvent(
                roomId,
                unixTimestamp,
                Direction.Forward,
            );
            logger.log(
                `/timestamp_to_event: ` +
                `found ${eventId} (${originServerTs}) for timestamp=${unixTimestamp} (looking forward)`,
            );

            dis.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                event_id: eventId,
                highlighted: true,
                room_id: roomId,
                metricsTrigger: undefined, // room doesn't change
            });
        } catch (e) {
            const code = e.errcode || e.statusCode;
            // only show the dialog if failing for something other than a network error
            // (e.g. no errcode or statusCode) as in that case the redactions end up in the
            // detached queue and we show the room status bar to allow retry
            if (typeof code !== "undefined") {
                // display error message stating you couldn't delete this.
                Modal.createDialog(ErrorDialog, {
                    title: _t('Error'),
                    description: _t('Unable to find event at that date. (%(code)s)', { code }),
                });
            }
        }
    };

    private onLastWeekClicked = (): void => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        this.pickDate(date);
        this.closeMenu();
    };

    private onLastMonthClicked = (): void => {
        const date = new Date();
        // Month numbers are 0 - 11 and `setMonth` handles the negative rollover
        date.setMonth(date.getMonth() - 1, 1);
        this.pickDate(date);
        this.closeMenu();
    };

    private onTheBeginningClicked = (): void => {
        const date = new Date(0);
        this.pickDate(date);
        this.closeMenu();
    };

    private onDatePicked = (dateString): void => {
        this.pickDate(dateString);
        this.closeMenu();
    };

    private renderJumpToDateMenu(): React.ReactElement {
        let contextMenu: JSX.Element;
        if (this.state.contextMenuPosition) {
            contextMenu = <IconizedContextMenu
                {...contextMenuBelow(this.state.contextMenuPosition)}
                onFinished={this.onContextMenuCloseClick}
            >
                <IconizedContextMenuOptionList first>
                    <IconizedContextMenuOption
                        label={_t("Last week")}
                        onClick={this.onLastWeekClicked}
                    />
                    <IconizedContextMenuOption
                        label={_t("Last month")}
                        onClick={this.onLastMonthClicked}
                    />
                    <IconizedContextMenuOption
                        label={_t("The beginning of the room")}
                        onClick={this.onTheBeginningClicked}
                    />
                </IconizedContextMenuOptionList>

                <IconizedContextMenuOptionList>
                    <JumpToDatePicker ts={this.props.ts} onDatePicked={this.onDatePicked} />
                </IconizedContextMenuOptionList>
            </IconizedContextMenu>;
        }

        return (
            <ContextMenuTooltipButton
                className="mx_DateSeparator_jumpToDateMenu"
                onClick={this.onContextMenuOpenClick}
                isExpanded={!!this.state.contextMenuPosition}
                title={_t("Jump to date")}
            >
                <h2 aria-hidden="true">{ this.getLabel() }</h2>
                <div className="mx_DateSeparator_chevron" />
                { contextMenu }
            </ContextMenuTooltipButton>
        );
    }

    render() {
        const label = this.getLabel();

        let dateHeaderContent;
        if (this.state.jumpToDateEnabled) {
            dateHeaderContent = this.renderJumpToDateMenu();
        } else {
            dateHeaderContent = <h2 aria-hidden="true">{ label }</h2>;
        }

        // ARIA treats <hr/>s as separators, here we abuse them slightly so manually treat this entire thing as one
        // tab-index=-1 to allow it to be focusable but do not add tab stop for it, primarily for screen readers
        return <div className="mx_DateSeparator" role="separator" tabIndex={-1} aria-label={label}>
            <hr role="none" />
            { dateHeaderContent }
            <hr role="none" />
        </div>;
    }
}
