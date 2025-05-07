/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { Direction, ConnectionError, MatrixError, HTTPError } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { capitalize } from "lodash";

import { _t, getUserLanguage } from "../../../languageHandler";
import { formatFullDateNoDay, formatFullDateNoTime, getDaysArray } from "../../../DateUtils";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import dispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import Modal from "../../../Modal";
import ErrorDialog from "../dialogs/ErrorDialog";
import BugReportDialog from "../dialogs/BugReportDialog";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import { contextMenuBelow } from "../rooms/RoomTile";
import { ContextMenuTooltipButton } from "../../structures/ContextMenu";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import JumpToDatePicker from "./JumpToDatePicker";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { SdkContextClass } from "../../../contexts/SDKContext";
import TimelineSeparator from "./TimelineSeparator";

interface IProps {
    roomId: string;
    ts: number;
    forExport?: boolean;
}

interface IState {
    contextMenuPosition?: DOMRect;
    jumpToDateEnabled: boolean;
}

/**
 * Timeline separator component to render within a MessagePanel bearing the date of the ts given
 *
 * Has additional jump to date functionality when labs flag is enabled
 */
export default class DateSeparator extends React.Component<IProps, IState> {
    private settingWatcherRef?: string;

    public constructor(props: IProps) {
        super(props);
        this.state = {
            jumpToDateEnabled: SettingsStore.getValue("feature_jump_to_date"),
        };
    }

    public componentDidMount(): void {
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

    public componentWillUnmount(): void {
        SettingsStore.unwatchSetting(this.settingWatcherRef);
    }

    private onContextMenuOpenClick = (e: ButtonEvent): void => {
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
            contextMenuPosition: undefined,
        });
    };

    private get relativeTimeFormat(): Intl.RelativeTimeFormat {
        return new Intl.RelativeTimeFormat(getUserLanguage(), { style: "long", numeric: "auto" });
    }

    private getLabel(): string {
        try {
            const date = new Date(this.props.ts);
            const disableRelativeTimestamps = !SettingsStore.getValue(UIFeature.TimelineEnableRelativeDates);

            // During the time the archive is being viewed, a specific day might not make sense, so we return the full date
            if (this.props.forExport || disableRelativeTimestamps) return formatFullDateNoTime(date);

            const today = new Date();
            const yesterday = new Date();
            const days = getDaysArray("long");
            yesterday.setDate(today.getDate() - 1);

            if (date.toDateString() === today.toDateString()) {
                return this.relativeTimeFormat.format(0, "day"); // Today
            } else if (date.toDateString() === yesterday.toDateString()) {
                return this.relativeTimeFormat.format(-1, "day"); // Yesterday
            } else if (today.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000) {
                return days[date.getDay()]; // Sunday-Saturday
            } else {
                return formatFullDateNoTime(date);
            }
        } catch {
            return _t("common|message_timestamp_invalid");
        }
    }

    private pickDate = async (inputTimestamp: number | string | Date): Promise<void> => {
        const unixTimestamp = new Date(inputTimestamp).getTime();
        const roomIdForJumpRequest = this.props.roomId;

        try {
            const cli = MatrixClientPeg.safeGet();
            const { event_id: eventId, origin_server_ts: originServerTs } = await cli.timestampToEvent(
                roomIdForJumpRequest,
                unixTimestamp,
                Direction.Forward,
            );
            logger.log(
                `/timestamp_to_event: ` +
                    `found ${eventId} (${originServerTs}) for timestamp=${unixTimestamp} (looking forward)`,
            );

            // Only try to navigate to the room if the user is still viewing the same
            // room. We don't want to jump someone back to a room after a slow request
            // if they've already navigated away to another room.
            const currentRoomId = SdkContextClass.instance.roomViewStore.getRoomId();
            if (currentRoomId === roomIdForJumpRequest) {
                dispatcher.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    event_id: eventId,
                    highlighted: true,
                    room_id: roomIdForJumpRequest,
                    metricsTrigger: undefined, // room doesn't change
                });
            } else {
                logger.debug(
                    `No longer navigating to date in room (jump to date) because the user already switched ` +
                        `to another room: currentRoomId=${currentRoomId}, roomIdForJumpRequest=${roomIdForJumpRequest}`,
                );
            }
        } catch (err) {
            logger.error(
                `Error occured while trying to find event in ${roomIdForJumpRequest} ` +
                    `at timestamp=${unixTimestamp}:`,
                err,
            );

            // Only display an error if the user is still viewing the same room. We
            // don't want to worry someone about an error in a room they no longer care
            // about after a slow request if they've already navigated away to another
            // room.
            const currentRoomId = SdkContextClass.instance.roomViewStore.getRoomId();
            if (currentRoomId === roomIdForJumpRequest) {
                let friendlyErrorMessage = "An error occured while trying to find and jump to the given date.";
                let submitDebugLogsContent: JSX.Element = <></>;
                if (err instanceof ConnectionError) {
                    friendlyErrorMessage = _t("room|error_jump_to_date_connection");
                } else if (err instanceof MatrixError) {
                    if (err?.errcode === "M_NOT_FOUND") {
                        friendlyErrorMessage = _t("room|error_jump_to_date_not_found", {
                            dateString: formatFullDateNoDay(new Date(unixTimestamp)),
                        });
                    } else {
                        friendlyErrorMessage = _t("room|error_jump_to_date", {
                            statusCode: err?.httpStatus || _t("room|unknown_status_code_for_timeline_jump"),
                            errorCode: err?.errcode || _t("common|unavailable"),
                        });
                    }
                } else if (err instanceof HTTPError) {
                    friendlyErrorMessage = err.message;
                } else {
                    // We only give the option to submit logs for actual errors, not network problems.
                    submitDebugLogsContent = (
                        <p>
                            {_t(
                                "room|error_jump_to_date_send_logs_prompt",
                                {},
                                {
                                    debugLogsLink: (sub) => (
                                        <AccessibleButton
                                            // This is by default a `<div>` which we
                                            // can't nest within a `<p>` here so update
                                            // this to a be a inline anchor element.
                                            element="a"
                                            kind="link"
                                            onClick={() => this.onBugReport(err instanceof Error ? err : undefined)}
                                            data-testid="jump-to-date-error-submit-debug-logs-button"
                                        >
                                            {sub}
                                        </AccessibleButton>
                                    ),
                                },
                            )}
                        </p>
                    );
                }

                Modal.createDialog(ErrorDialog, {
                    title: _t("room|error_jump_to_date_title"),
                    description: (
                        <div data-testid="jump-to-date-error-content">
                            <p>{friendlyErrorMessage}</p>
                            {submitDebugLogsContent}
                            <details>
                                <summary>{_t("room|error_jump_to_date_details")}</summary>
                                <p>{String(err)}</p>
                            </details>
                        </div>
                    ),
                });
            }
        }
    };

    private onBugReport = (err?: Error): void => {
        Modal.createDialog(BugReportDialog, {
            error: err,
            initialText: "Error occured while using jump to date #jump-to-date",
        });
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

    private onDatePicked = (dateString: string): void => {
        this.pickDate(dateString);
        this.closeMenu();
    };

    private renderJumpToDateMenu(): React.ReactElement {
        let contextMenu: JSX.Element | undefined;
        if (this.state.contextMenuPosition) {
            const relativeTimeFormat = this.relativeTimeFormat;
            contextMenu = (
                <IconizedContextMenu
                    {...contextMenuBelow(this.state.contextMenuPosition)}
                    onFinished={this.onContextMenuCloseClick}
                >
                    <IconizedContextMenuOptionList first>
                        <IconizedContextMenuOption
                            label={capitalize(relativeTimeFormat.format(-1, "week"))}
                            onClick={this.onLastWeekClicked}
                            data-testid="jump-to-date-last-week"
                        />
                        <IconizedContextMenuOption
                            label={capitalize(relativeTimeFormat.format(-1, "month"))}
                            onClick={this.onLastMonthClicked}
                            data-testid="jump-to-date-last-month"
                        />
                        <IconizedContextMenuOption
                            label={_t("room|jump_to_date_beginning")}
                            onClick={this.onTheBeginningClicked}
                            data-testid="jump-to-date-beginning"
                        />
                    </IconizedContextMenuOptionList>

                    <IconizedContextMenuOptionList>
                        <JumpToDatePicker ts={this.props.ts} onDatePicked={this.onDatePicked} />
                    </IconizedContextMenuOptionList>
                </IconizedContextMenu>
            );
        }

        return (
            <ContextMenuTooltipButton
                className="mx_DateSeparator_jumpToDateMenu mx_DateSeparator_dateContent"
                data-testid="jump-to-date-separator-button"
                onClick={this.onContextMenuOpenClick}
                isExpanded={!!this.state.contextMenuPosition}
                title={_t("room|jump_to_date")}
            >
                <h2 className="mx_DateSeparator_dateHeading" aria-hidden="true">
                    {this.getLabel()}
                </h2>
                <div className="mx_DateSeparator_chevron" />
                {contextMenu}
            </ContextMenuTooltipButton>
        );
    }

    public render(): React.ReactNode {
        const label = this.getLabel();

        let dateHeaderContent: JSX.Element;
        if (this.state.jumpToDateEnabled) {
            dateHeaderContent = this.renderJumpToDateMenu();
        } else {
            dateHeaderContent = (
                <div className="mx_DateSeparator_dateContent">
                    <h2 className="mx_DateSeparator_dateHeading" aria-hidden="true">
                        {label}
                    </h2>
                </div>
            );
        }

        return <TimelineSeparator label={label}>{dateHeaderContent}</TimelineSeparator>;
    }
}
