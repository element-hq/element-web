/*
Copyright 2021 New Vector Ltd

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

import React, { CSSProperties } from "react";

interface IProps {
    backgroundImage?: string;
    blurMultiplier?: number;
}

export const BackdropPanel: React.FC<IProps> = ({ backgroundImage, blurMultiplier }) => {
    if (!backgroundImage) return null;

    const styles: CSSProperties = {};
    if (blurMultiplier) {
        const rootStyle = getComputedStyle(document.documentElement);
        const blurValue = rootStyle.getPropertyValue("--lp-background-blur");
        const pixelsValue = blurValue.replace("px", "");
        const parsed = parseInt(pixelsValue, 10);
        if (!isNaN(parsed)) {
            styles.filter = `blur(${parsed * blurMultiplier}px)`;
        }
    }
    return (
        <div className="mx_BackdropPanel">
            <img role="presentation" alt="" style={styles} className="mx_BackdropPanel--image" src={backgroundImage} />
        </div>
    );
};
export default BackdropPanel;
