/*
Copyright 2019 Vector Creations Ltd

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
import PropTypes from 'prop-types';
import sdk from '../../../index';
import { _t, _td } from '../../../languageHandler';

function capFirst(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export default class VerificationShowSas extends React.Component {
    static propTypes = {
        onDone: PropTypes.func.isRequired,
        onCancel: PropTypes.func.isRequired,
        sas: PropTypes.object.isRequired,
    }

    constructor() {
        super();
    }

    render() {
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        let sasDisplay;
        let sasCaption;
        if (this.props.sas.emoji) {
            const emojiBlocks = this.props.sas.emoji.map(
                (emoji, i) => <div className="mx_VerificationShowSas_emojiSas_block" key={i}>
                    <div className="mx_VerificationShowSas_emojiSas_emoji">
                        { emoji[0] }
                    </div>
                    <div className="mx_VerificationShowSas_emojiSas_label">
                        {_t(capFirst(emoji[1]))}
                    </div>
                </div>,
            );
            sasDisplay = <div className="mx_VerificationShowSas_emojiSas">
                {emojiBlocks}
            </div>;
            sasCaption = _t(
                "Verify this user by confirming the following emoji appear on their screen.",
            );
        } else if (this.props.sas.decimal) {
            const numberBlocks = this.props.sas.decimal.map((num, i) => <span key={i}>
                {num}
            </span>);
            sasDisplay = <div className="mx_VerificationShowSas_decimalSas">
                {numberBlocks}
            </div>;
            sasCaption = _t(
                "Verify this user by confirming the following number appears on their screen.",
            );
        } else {
            return <div>
                {_t("Unable to find a supported verification method.")}
                <DialogButtons
                    primaryButton={_t('Cancel')}
                    hasCancel={false}
                    onPrimaryButtonClick={this.props.onCancel}
                />
            </div>;
        }

        return <div className="mx_VerificationShowSas">
            <p>{sasCaption}</p>
            <p>{_t(
                "For maximum security, we recommend you do this in person or use another " +
                "trusted means of communication.",
            )}</p>
            {sasDisplay}
            <DialogButtons onPrimaryButtonClick={this.props.onDone}
                primaryButton={_t("Continue")}
                hasCancel={true}
                onCancel={this.props.onCancel}
            />
        </div>;
    }
}

// List of Emoji strings from the js-sdk, for i18n
_td("Dog");
_td("Cat");
_td("Lion");
_td("Horse");
_td("Unicorn");
_td("Pig");
_td("Elephant");
_td("Rabbit");
_td("Panda");
_td("Rooster");
_td("Penguin");
_td("Turtle");
_td("Fish");
_td("Octopus");
_td("Butterfly");
_td("Flower");
_td("Tree");
_td("Cactus");
_td("Mushroom");
_td("Globe");
_td("Moon");
_td("Cloud");
_td("Fire");
_td("Banana");
_td("Apple");
_td("Strawberry");
_td("Corn");
_td("Pizza");
_td("Cake");
_td("Heart");
_td("Smiley");
_td("Robot");
_td("Hat");
_td("Glasses");
_td("Spanner");
_td("Santa");
_td("Thumbs up");
_td("Umbrella");
_td("Hourglass");
_td("Clock");
_td("Gift");
_td("Light bulb");
_td("Book");
_td("Pencil");
_td("Paperclip");
_td("Scissors");
_td("Padlock");
_td("Key");
_td("Hammer");
_td("Telephone");
_td("Flag");
_td("Train");
_td("Bicycle");
_td("Aeroplane");
_td("Rocket");
_td("Trophy");
_td("Ball");
_td("Guitar");
_td("Trumpet");
_td("Bell");
_td("Anchor");
_td("Headphones");
_td("Folder");
_td("Pin");
