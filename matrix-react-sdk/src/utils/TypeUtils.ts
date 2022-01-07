/*
Copyright 2019 New Vector Ltd

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

/**
 * Creates a class of a given type using the objects defined. This
 * is a stopgap function while we don't have TypeScript interfaces.
 * In future, we'd define the `type` as an interface and just cast
 * it instead of cheating like we are here.
 * @param {Type} Type The type of class to construct.
 * @param {*} opts The options (properties) to set on the object.
 * @returns {*} The created object.
 */
export function makeType(Type: any, opts: any) {
    const c = new Type();
    Object.assign(c, opts);
    return c;
}
