/*
Copyright 2019, 2021 The Matrix.org Foundation C.I.C.

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

import React, { SyntheticEvent } from "react";
import classNames from "classnames";
import { MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/models/event";
import { Relations, RelationsEvent } from "matrix-js-sdk/src/models/relations";

import { _t } from "../../../languageHandler";
import { isContentActionable } from "../../../utils/EventUtils";
import { ContextMenuTooltipButton } from "../../../accessibility/context_menu/ContextMenuTooltipButton";
import ContextMenu, { aboveLeftOf, useContextMenu } from "../../structures/ContextMenu";
import ReactionPicker from "../emojipicker/ReactionPicker";
import ReactionsRowButton from "./ReactionsRowButton";
import RoomContext from "../../../contexts/RoomContext";
import AccessibleButton from "../elements/AccessibleButton";

// The maximum number of reactions to initially show on a message.
const MAX_ITEMS_WHEN_LIMITED = 8;

const ReactButton: React.FC<IProps> = ({ mxEvent, reactions }) => {
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu();

    let contextMenu: JSX.Element | undefined;
    if (menuDisplayed && button.current) {
        const buttonRect = button.current.getBoundingClientRect();
        contextMenu = (
            <ContextMenu {...aboveLeftOf(buttonRect)} onFinished={closeMenu} managed={false}>
                <ReactionPicker mxEvent={mxEvent} reactions={reactions} onFinished={closeMenu} />
            </ContextMenu>
        );
    }

    return (
        <React.Fragment>
            <ContextMenuTooltipButton
                className={classNames("mx_ReactionsRow_addReactionButton", {
                    mx_ReactionsRow_addReactionButton_active: menuDisplayed,
                })}
                title={_t("Add reaction")}
                onClick={openMenu}
                onContextMenu={(e: SyntheticEvent): void => {
                    e.preventDefault();
                    openMenu();
                }}
                isExpanded={menuDisplayed}
                inputRef={button}
            />

            {contextMenu}
        </React.Fragment>
    );
};

interface IProps {
    // The event we're displaying reactions for
    mxEvent: MatrixEvent;
    // The Relations model from the JS SDK for reactions to `mxEvent`
    reactions?: Relations | null | undefined;
}

interface IState {
    myReactions: MatrixEvent[] | null;
    showAll: boolean;
}

export default class ReactionsRow extends React.PureComponent<IProps, IState> {
    public static contextType = RoomContext;
    public context!: React.ContextType<typeof RoomContext>;

    public constructor(props: IProps, context: React.ContextType<typeof RoomContext>) {
        super(props, context);
        this.context = context;

        this.state = {
            myReactions: this.getMyReactions(),
            showAll: false,
        };
    }

    public componentDidMount(): void {
        const { mxEvent, reactions } = this.props;

        if (mxEvent.isBeingDecrypted() || mxEvent.shouldAttemptDecryption()) {
            mxEvent.once(MatrixEventEvent.Decrypted, this.onDecrypted);
        }

        if (reactions) {
            reactions.on(RelationsEvent.Add, this.onReactionsChange);
            reactions.on(RelationsEvent.Remove, this.onReactionsChange);
            reactions.on(RelationsEvent.Redaction, this.onReactionsChange);
        }
    }

    public componentWillUnmount(): void {
        const { mxEvent, reactions } = this.props;

        mxEvent.off(MatrixEventEvent.Decrypted, this.onDecrypted);

        if (reactions) {
            reactions.off(RelationsEvent.Add, this.onReactionsChange);
            reactions.off(RelationsEvent.Remove, this.onReactionsChange);
            reactions.off(RelationsEvent.Redaction, this.onReactionsChange);
        }
    }

    public componentDidUpdate(prevProps: IProps): void {
        if (this.props.reactions && prevProps.reactions !== this.props.reactions) {
            this.props.reactions.on(RelationsEvent.Add, this.onReactionsChange);
            this.props.reactions.on(RelationsEvent.Remove, this.onReactionsChange);
            this.props.reactions.on(RelationsEvent.Redaction, this.onReactionsChange);
            this.onReactionsChange();
        }
    }

    private onDecrypted = (): void => {
        // Decryption changes whether the event is actionable
        this.forceUpdate();
    };

    private onReactionsChange = (): void => {
        // TODO: Call `onHeightChanged` as needed
        this.setState({
            myReactions: this.getMyReactions(),
        });
        // Using `forceUpdate` for the moment, since we know the overall set of reactions
        // has changed (this is triggered by events for that purpose only) and
        // `PureComponent`s shallow state / props compare would otherwise filter this out.
        this.forceUpdate();
    };

    private getMyReactions(): MatrixEvent[] | null {
        const reactions = this.props.reactions;
        if (!reactions) {
            return null;
        }
        const userId = this.context.room?.client.getUserId();
        if (!userId) return null;
        const myReactions = reactions.getAnnotationsBySender()?.[userId];
        if (!myReactions) {
            return null;
        }
        return [...myReactions.values()];
    }

    private onShowAllClick = (): void => {
        this.setState({
            showAll: true,
        });
    };

    public render(): React.ReactNode {
        const { mxEvent, reactions } = this.props;
        const { myReactions, showAll } = this.state;

        if (!reactions || !isContentActionable(mxEvent)) {
            return null;
        }

        let items = reactions
            .getSortedAnnotationsByKey()
            ?.map(([content, events]) => {
                const count = events.size;
                if (!count) {
                    return null;
                }
                const myReactionEvent = myReactions?.find((mxEvent) => {
                    if (mxEvent.isRedacted()) {
                        return false;
                    }
                    return mxEvent.getRelation()?.key === content;
                });
                return (
                    <ReactionsRowButton
                        key={content}
                        content={content}
                        count={count}
                        mxEvent={mxEvent}
                        reactionEvents={events}
                        myReactionEvent={myReactionEvent}
                        disabled={
                            !this.context.canReact ||
                            (myReactionEvent && !myReactionEvent.isRedacted() && !this.context.canSelfRedact)
                        }
                    />
                );
            })
            .filter((item) => !!item);

        if (!items?.length) return null;

        // Show the first MAX_ITEMS if there are MAX_ITEMS + 1 or more items.
        // The "+ 1" ensure that the "show all" reveals something that takes up
        // more space than the button itself.
        let showAllButton: JSX.Element | undefined;
        if (items.length > MAX_ITEMS_WHEN_LIMITED + 1 && !showAll) {
            items = items.slice(0, MAX_ITEMS_WHEN_LIMITED);
            showAllButton = (
                <AccessibleButton kind="link_inline" className="mx_ReactionsRow_showAll" onClick={this.onShowAllClick}>
                    {_t("Show all")}
                </AccessibleButton>
            );
        }

        let addReactionButton: JSX.Element | undefined;
        if (this.context.canReact) {
            addReactionButton = <ReactButton mxEvent={mxEvent} reactions={reactions} />;
        }

        return (
            <div className="mx_ReactionsRow" role="toolbar" aria-label={_t("Reactions")}>
                {items}
                {showAllButton}
                {addReactionButton}
            </div>
        );
    }
}
