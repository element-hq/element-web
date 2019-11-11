/*
Copyright 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React, {useState, useEffect, useRef} from 'react';
import PropTypes from 'prop-types';

import { _t } from '../../../languageHandler';
import sdk from '../../../index';
import dis from '../../../dispatcher';
import Modal from '../../../Modal';
import {ContextMenu} from '../../structures/ContextualMenu';
import { isContentActionable, canEditContent } from '../../../utils/EventUtils';
import {RoomContext} from "../../structures/RoomView";

const useContextMenu = () => {
    const _button = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const open = () => {
        setIsOpen(true);
    };
    const close = () => {
        setIsOpen(false);
    };

    return [isOpen, _button, open, close, setIsOpen];
};

const OptionsButton = ({mxEvent, getTile, getReplyThread, permalinkCreator, onFocusChange}) => {
    const [menuDisplayed, _button, openMenu, closeMenu] = useContextMenu();
    useEffect(() => {
        onFocusChange(menuDisplayed);
    }, [onFocusChange, menuDisplayed]);

    let contextMenu;
    if (menuDisplayed) {
        const MessageContextMenu = sdk.getComponent('context_menus.MessageContextMenu');

        const tile = getTile && getTile();
        const replyThread = getReplyThread && getReplyThread();

        const onCryptoClick = () => {
            Modal.createTrackedDialogAsync('Encrypted Event Dialog', '',
                import('../../../async-components/views/dialogs/EncryptedEventDialog'),
                {event: mxEvent},
            );
        };

        let e2eInfoCallback = null;
        if (mxEvent.isEncrypted()) {
            e2eInfoCallback = onCryptoClick;
        }

        const menuOptions = {
            chevronFace: "none",
        };

        const buttonRect = _button.current.getBoundingClientRect();
        // The window X and Y offsets are to adjust position when zoomed in to page
        const buttonRight = buttonRect.right + window.pageXOffset;
        const buttonBottom = buttonRect.bottom + window.pageYOffset;
        const buttonTop = buttonRect.top + window.pageYOffset;
        // Align the right edge of the menu to the right edge of the button
        menuOptions.right = window.innerWidth - buttonRight;
        // Align the menu vertically on whichever side of the button has more
        // space available.
        if (buttonBottom < window.innerHeight / 2) {
            menuOptions.top = buttonBottom;
        } else {
            menuOptions.bottom = window.innerHeight - buttonTop;
        }

        contextMenu = <ContextMenu props={menuOptions} onFinished={closeMenu}>
            <MessageContextMenu
                mxEvent={mxEvent}
                permalinkCreator={permalinkCreator}
                eventTileOps={tile && tile.getEventTileOps ? tile.getEventTileOps() : undefined}
                collapseReplyThread={replyThread && replyThread.canCollapse() ? replyThread.collapse : undefined}
                e2eInfoCallback={e2eInfoCallback}
                onFinished={closeMenu}
            />
        </ContextMenu>;
    }

    const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
    return <React.Fragment>
        <AccessibleButton
            className="mx_MessageActionBar_maskButton mx_MessageActionBar_optionsButton"
            title={_t("Options")}
            onClick={openMenu}
            aria-haspopup={true}
            aria-expanded={menuDisplayed}
            inputRef={_button}
        />

        { contextMenu }
    </React.Fragment>;
};

const ReactButton = ({mxEvent, reactions}) => {
    const [menuDisplayed, _button, openMenu, closeMenu] = useContextMenu();

    let contextMenu;
    if (menuDisplayed) {
        const menuOptions = {
            chevronFace: "none",
        };

        const buttonRect = _button.current.getBoundingClientRect();
        // The window X and Y offsets are to adjust position when zoomed in to page
        const buttonRight = buttonRect.right + window.pageXOffset;
        const buttonBottom = buttonRect.bottom + window.pageYOffset;
        const buttonTop = buttonRect.top + window.pageYOffset;
        // Align the right edge of the menu to the right edge of the button
        menuOptions.right = window.innerWidth - buttonRight;
        // Align the menu vertically on whichever side of the button has more
        // space available.
        if (buttonBottom < window.innerHeight / 2) {
            menuOptions.top = buttonBottom;
        } else {
            menuOptions.bottom = window.innerHeight - buttonTop;
        }

        const ReactionPicker = sdk.getComponent('emojipicker.ReactionPicker');
        contextMenu = <ContextMenu props={menuOptions} onFinished={closeMenu}>
            <ReactionPicker mxEvent={mxEvent} reactions={reactions} onFinished={closeMenu} />
        </ContextMenu>;
    }

    const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
    return <React.Fragment>
        <AccessibleButton
            className="mx_MessageActionBar_maskButton mx_MessageActionBar_reactButton"
            title={_t("React")}
            onClick={openMenu}
            aria-haspopup={true}
            aria-expanded={menuDisplayed}
            inputRef={_button}
        />

        { contextMenu }
    </React.Fragment>;
};

export default class MessageActionBar extends React.PureComponent {
    static propTypes = {
        mxEvent: PropTypes.object.isRequired,
        // The Relations model from the JS SDK for reactions to `mxEvent`
        reactions: PropTypes.object,
        permalinkCreator: PropTypes.object,
        getTile: PropTypes.func,
        getReplyThread: PropTypes.func,
        onFocusChange: PropTypes.func,
    };

    static contextTypes = {
        room: RoomContext,
    };

    componentDidMount() {
        this.props.mxEvent.on("Event.decrypted", this.onDecrypted);
    }

    componentWillUnmount() {
        this.props.mxEvent.removeListener("Event.decrypted", this.onDecrypted);
    }

    onDecrypted = () => {
        // When an event decrypts, it is likely to change the set of available
        // actions, so we force an update to check again.
        this.forceUpdate();
    };

    onFocusChange = (focused) => {
        if (!this.props.onFocusChange) {
            return;
        }
        this.props.onFocusChange(focused);
    };

    onReplyClick = (ev) => {
        dis.dispatch({
            action: 'reply_to_event',
            event: this.props.mxEvent,
        });
    };

    onEditClick = (ev) => {
        dis.dispatch({
            action: 'edit_event',
            event: this.props.mxEvent,
        });
    };

    render() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        let reactButton;
        let replyButton;
        let editButton;

        if (isContentActionable(this.props.mxEvent)) {
            if (this.context.room.canReact) {
                reactButton = <ReactButton mxEvent={this.props.mxEvent} reactions={this.props.reactions} />;
            }
            if (this.context.room.canReply) {
                replyButton = <AccessibleButton
                    className="mx_MessageActionBar_maskButton mx_MessageActionBar_replyButton"
                    title={_t("Reply")}
                    onClick={this.onReplyClick}
                />;
            }
        }
        if (canEditContent(this.props.mxEvent)) {
            editButton = <AccessibleButton
                className="mx_MessageActionBar_maskButton mx_MessageActionBar_editButton"
                title={_t("Edit")}
                onClick={this.onEditClick}
            />;
        }

        // aria-live=off to not have this read out automatically as navigating around timeline, gets repetitive.
        return <div className="mx_MessageActionBar" role="toolbar" aria-label={_t("Message Actions")} aria-live="off">
            {reactButton}
            {replyButton}
            {editButton}
            <OptionsButton
                mxEvent={this.props.mxEvent}
                getReplyThread={this.props.getReplyThread}
                getTile={this.props.getTile}
                permalinkCreator={this.props.permalinkCreator}
                onFocusChange={this.props.onFocusChange}
            />
        </div>;
    }
}
