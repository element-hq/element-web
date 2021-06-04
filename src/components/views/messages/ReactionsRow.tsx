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

import React from "react";
import classNames from "classnames";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Relations } from "matrix-js-sdk/src/models/relations";

import { _t } from '../../../languageHandler';
import { isContentActionable } from '../../../utils/EventUtils';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { ContextMenuTooltipButton } from "../../../accessibility/context_menu/ContextMenuTooltipButton";
import { aboveLeftOf, ContextMenu, useContextMenu } from "../../structures/ContextMenu";
import ReactionPicker from "../emojipicker/ReactionPicker";
import ReactionsRowButton from "./ReactionsRowButton";
import MatrixClientContext from "../../../contexts/MatrixClientContext";

// The maximum number of reactions to initially show on a message.
const MAX_ITEMS_WHEN_LIMITED = 8;

const ReactButton = ({ mxEvent, reactions }: IProps) => {
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu();

    let contextMenu;
    if (menuDisplayed) {
        const buttonRect = button.current.getBoundingClientRect();
        contextMenu = <ContextMenu {...aboveLeftOf(buttonRect)} onFinished={closeMenu} managed={false}>
            <ReactionPicker mxEvent={mxEvent} reactions={reactions} onFinished={closeMenu} />
        </ContextMenu>;
    }

    return <React.Fragment>
        <ContextMenuTooltipButton
            className={classNames("mx_ReactionsRow_addReactionButton", {
                mx_ReactionsRow_addReactionButton_active: menuDisplayed,
            })}
            title={_t("Add reaction")}
            onClick={openMenu}
            onContextMenu={e => {
                e.preventDefault();
                openMenu();
            }}
            isExpanded={menuDisplayed}
            inputRef={button}
        />

        { contextMenu }
    </React.Fragment>;
};

interface IProps {
    // The event we're displaying reactions for
    mxEvent: MatrixEvent;
    // The Relations model from the JS SDK for reactions to `mxEvent`
    reactions?: Relations;
}

interface IState {
    myReactions: MatrixEvent[];
    showAll: boolean;
}

@replaceableComponent("views.messages.ReactionsRow")
export default class ReactionsRow extends React.PureComponent<IProps, IState> {
    static contextType = MatrixClientContext;

    constructor(props, context) {
        super(props, context);

        this.state = {
            myReactions: this.getMyReactions(),
            showAll: false,
        };
    }

    componentDidMount() {
        const { mxEvent, reactions } = this.props;

        if (mxEvent.isBeingDecrypted() || mxEvent.shouldAttemptDecryption()) {
            mxEvent.once("Event.decrypted", this.onDecrypted);
        }

        if (reactions) {
            reactions.on("Relations.add", this.onReactionsChange);
            reactions.on("Relations.remove", this.onReactionsChange);
            reactions.on("Relations.redaction", this.onReactionsChange);
        }
    }

    componentWillUnmount() {
        const { mxEvent, reactions } = this.props;

        mxEvent.off("Event.decrypted", this.onDecrypted);

        if (reactions) {
            reactions.off("Relations.add", this.onReactionsChange);
            reactions.off("Relations.remove", this.onReactionsChange);
            reactions.off("Relations.redaction", this.onReactionsChange);
        }
    }

    componentDidUpdate(prevProps: IProps) {
        if (prevProps.reactions !== this.props.reactions) {
            this.props.reactions.on("Relations.add", this.onReactionsChange);
            this.props.reactions.on("Relations.remove", this.onReactionsChange);
            this.props.reactions.on("Relations.redaction", this.onReactionsChange);
            this.onReactionsChange();
        }
    }

    private onDecrypted = () => {
        // Decryption changes whether the event is actionable
        this.forceUpdate();
    }

    private onReactionsChange = () => {
        // TODO: Call `onHeightChanged` as needed
        this.setState({
            myReactions: this.getMyReactions(),
        });
        // Using `forceUpdate` for the moment, since we know the overall set of reactions
        // has changed (this is triggered by events for that purpose only) and
        // `PureComponent`s shallow state / props compare would otherwise filter this out.
        this.forceUpdate();
    }

    private getMyReactions() {
        const reactions = this.props.reactions;
        if (!reactions) {
            return null;
        }
        const userId = this.context.getUserId();
        const myReactions = reactions.getAnnotationsBySender()[userId];
        if (!myReactions) {
            return null;
        }
        return [...myReactions.values()];
    }

    private onShowAllClick = () => {
        this.setState({
            showAll: true,
        });
    }

    render() {
        const { mxEvent, reactions } = this.props;
        const { myReactions, showAll } = this.state;

        if (!reactions || !isContentActionable(mxEvent)) {
            return null;
        }

        let items = reactions.getSortedAnnotationsByKey().map(([content, events]) => {
            const count = events.size;
            if (!count) {
                return null;
            }
            const myReactionEvent = myReactions && myReactions.find(mxEvent => {
                if (mxEvent.isRedacted()) {
                    return false;
                }
                return mxEvent.getRelation().key === content;
            });
            return <ReactionsRowButton
                key={content}
                content={content}
                count={count}
                mxEvent={mxEvent}
                reactionEvents={events}
                myReactionEvent={myReactionEvent}
            />;
        }).filter(item => !!item);

        if (!items.length) return null;

        // Show the first MAX_ITEMS if there are MAX_ITEMS + 1 or more items.
        // The "+ 1" ensure that the "show all" reveals something that takes up
        // more space than the button itself.
        let showAllButton;
        if ((items.length > MAX_ITEMS_WHEN_LIMITED + 1) && !showAll) {
            items = items.slice(0, MAX_ITEMS_WHEN_LIMITED);
            showAllButton = <a
                className="mx_ReactionsRow_showAll"
                href="#"
                onClick={this.onShowAllClick}
            >
                {_t("Show all")}
            </a>;
        }

        const cli = this.context;

        let addReactionButton;
        const room = cli.getRoom(mxEvent.getRoomId());
        if (room.getMyMembership() === "join" && room.currentState.maySendEvent(EventType.Reaction, cli.getUserId())) {
            addReactionButton = <ReactButton mxEvent={mxEvent} reactions={reactions} />;
        }

        return <div
            className="mx_ReactionsRow"
            role="toolbar"
            aria-label={_t("Reactions")}
        >
            { items }
            { showAllButton }
            { addReactionButton }
        </div>;
    }
}
