/*
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

import * as React from 'react';
import * as sdk from '../index';

/**
 * Replaces a component with a skinned version if a skinned version exists.
 * This decorator should only be applied to components which can be skinned. For
 * the react-sdk this means all components should be decorated with this.
 *
 * The decoration works by assuming the skin has been loaded prior to the
 * decorator being called. If that's not the case, the developer will find
 * out quickly through various amounts of errors and explosions.
 *
 * For a bit more detail on how this works, see docs/skinning.md
 * @param {string} name The dot-path name of the component being replaced.
 * @param {React.Component} origComponent The component that can be replaced
 * with a skinned version. If no skinned version is available, this component
 * will be used.
 */
export function replaceableComponent(name: string, origComponent: React.Component) {
    // Decorators return a function to override the class (origComponent). This
    // ultimately assumes that `getComponent()` won't throw an error and instead
    // return a falsey value like `null` when the skin doesn't have a component.
    return () => sdk.getComponent(name) || origComponent;
}
