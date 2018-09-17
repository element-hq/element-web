/*
Michael Telatynski <7t3chguy@gmail.com>

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

/****************************************************************
 **                                                            **
 **  THIS CLASS IS NOT USED TO RENDER ALIAS CHANGES, IN ORDER  **
 **  TO TRY TO KEEP THINGS SIMPLE AND JUST USE TextualEvent.   **
 **                                                            **
 **  The code is kept here for ease of reference in future     **
 **  should we need the GenericEventListSummary stuff          **
 **                                                            **
 ****************************************************************/

'use strict';

import React from 'react';
import PropTypes from 'prop-types';
import { _t } from '../../../languageHandler';

export class GenericEventListSummary extends React.Component {
    static propTypes = {
        // An summary to display when collapsed
        summary: PropTypes.string.isRequired,
        // whether to show summary whilst children are expanded
        alwaysShowSummary: PropTypes.bool,
        // An array of EventTiles to render when expanded
        children: PropTypes.array.isRequired,
        // Called when the GELS expansion is toggled
        onToggle: PropTypes.func,
        // how many children should cause GELS to act
        threshold: PropTypes.number.isRequired,
    };

    static defaultProps = {
        threshold: 1,
    };

    constructor(props, context) {
        super(props, context);
        this._toggleSummary = this._toggleSummary.bind(this);
    }

    state = {
        expanded: false,
    };

    _toggleSummary() {
        this.setState({expanded: !this.state.expanded});
        this.props.onToggle();
    }

    render() {
        const fewEvents = this.props.children.length < this.props.threshold;
        const expanded = this.state.expanded || fewEvents;
        const showSummary = !expanded || this.props.alwaysShowSummary;

        let expandedEvents = null;
        if (expanded) {
            expandedEvents = this.props.children;
        }

        if (fewEvents) {
            return <div className="mx_MemberEventListSummary">{ expandedEvents }</div>;
        }

        let summaryContainer = null;
        if (showSummary) {
            summaryContainer = (
                <div>
                    {this.props.summary}
                </div>
            );
        }
        let toggleButton = null;
        if (!fewEvents) {
            toggleButton = <div className={"mx_MemberEventListSummary_toggle"} onClick={this._toggleSummary}>
                {expanded ? 'collapse' : 'expand'}
            </div>;
        }

        return (
            <div className="mx_MemberEventListSummary">
                {toggleButton}
                {summaryContainer}
                {/*{showSummary ? <div className="mx_MemberEventListSummary_line">&nbsp;</div> : null}*/}
                {expandedEvents}
            </div>
        );
    }
}

export default class RoomAliasesEvent extends React.Component {
    static PropTypes = {
        /* the MatrixEvent to show */
        mxEvent: PropTypes.object.isRequired,

        /* the shsape of the tile, used */
        tileShape: PropTypes.string,
    };

    getEventTileOps() {
        return this.refs.body && this.refs.body.getEventTileOps ? this.refs.body.getEventTileOps() : null;
    }

    render() {
        const senderName = this.props.mxEvent.sender ? this.props.mxEvent.sender.name : this.props.mxEvent.getSender();
        const oldAliases = this.props.mxEvent.getPrevContent().aliases || [];
        const newAliases = this.props.mxEvent.getContent().aliases || [];

        const addedAliases = newAliases.filter((x) => !oldAliases.includes(x));
        const removedAliases = oldAliases.filter((x) => !newAliases.includes(x));

        if (!addedAliases.length && !removedAliases.length) {
            return '';
        }

        if (addedAliases.length && !removedAliases.length) {
            return <div>{_t('%(senderName)s added %(count)s %(addedAddresses)s as addresses for this room.', {
                senderName: senderName,
                count: addedAliases.length,
                addedAddresses: addedAliases.join(', '),
            })}</div>;
        } else if (!addedAliases.length && removedAliases.length) {
            return <div>{_t('%(senderName)s removed %(count)s %(removedAddresses)s as addresses for this room.', {
                senderName: senderName,
                count: removedAliases.length,
                removedAddresses: removedAliases.join(', '),
            })}</div>;
        } else {
            // const args = {
            //     senderName: senderName,
            //     addedAddresses: addedAliases.join(', '),
            //     removedAddresses: removedAliases.join(', '),
            // };

            const changes = [];
            addedAliases.forEach((alias) => {
                changes.push(<div key={'+' + alias}>{_t('%(senderName)s added %(alias)s', {
                    senderName, alias,
                })}</div>);
            });
            removedAliases.forEach((alias) => {
                changes.push(<div key={'-' + alias}>{_t('%(senderName)s removed %(alias)s', {
                    senderName, alias,
                })}</div>);
            });

            const summary = _t('%(senderName)s changed the addresses of this room.', {senderName});
            return <GenericEventListSummary alwaysShowSummary={true} summary={summary}>
                {changes}
            </GenericEventListSummary>;
        }

        // return <BodyType ref="body" mxEvent={this.props.mxEvent} highlights={this.props.highlights}
        //             highlightLink={this.props.highlightLink}
        //             showUrlPreview={this.props.showUrlPreview}
        //             tileShape={this.props.tileShape}
        //             onWidgetLoad={this.props.onWidgetLoad} />;
    }
}
