/*
Copyright 2018 New Vector Ltd
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

/*
classNames:
    // class on resize-handle
    handle: string
    // class on resize-handle
    reverse: string
    // class on resize-handle
    vertical: string
    // class on container
    resizing: string
*/


export default class Resizer {
    // TODO move vertical/horizontal to config option/container class
    // as it doesn't make sense to mix them within one container/Resizer
    constructor(container, distributorCtor, config) {
        if (!container) {
            throw new Error("Resizer requires a non-null `container` arg");
        }
        this.container = container;
        this.distributorCtor = distributorCtor;
        this.config = config;
        this.classNames = {
            handle: "resizer-handle",
            reverse: "resizer-reverse",
            vertical: "resizer-vertical",
            resizing: "resizer-resizing",
        };
        this._onMouseDown = this._onMouseDown.bind(this);
    }

    setClassNames(classNames) {
        this.classNames = classNames;
    }

    attach() {
        this.container.addEventListener("mousedown", this._onMouseDown, false);
    }

    detach() {
        this.container.removeEventListener("mousedown", this._onMouseDown, false);
    }

    /**
    Gives the distributor for a specific resize handle, as if you would have started
    to drag that handle. Can be used to manipulate the size of an item programmatically.
    @param {number} handleIndex the index of the resize handle in the container
    @return {Distributor} a new distributor for the given handle
    */
    forHandleAt(handleIndex) {
        const handles = this._getResizeHandles();
        const handle = handles[handleIndex];
        if (handle) {
            const {distributor} = this._createSizerAndDistributor(handle);
            return distributor;
        }
    }

    forHandleWithId(id) {
        const handles = this._getResizeHandles();
        const handle = handles.find((h) => h.getAttribute("data-id") === id);
        if (handle) {
            const {distributor} = this._createSizerAndDistributor(handle);
            return distributor;
        }
    }

    isReverseResizeHandle(el) {
        return el && el.classList.contains(this.classNames.reverse);
    }

    isResizeHandle(el) {
        return el && el.classList.contains(this.classNames.handle);
    }

    _onMouseDown(event) {
        // use closest in case the resize handle contains
        // child dom nodes that can be the target
        const resizeHandle = event.target && event.target.closest(`.${this.classNames.handle}`);
        if (!resizeHandle || resizeHandle.parentElement !== this.container) {
            return;
        }
        // prevent starting a drag operation
        event.preventDefault();

        // mark as currently resizing
        if (this.classNames.resizing) {
            this.container.classList.add(this.classNames.resizing);
        }

        const {sizer, distributor} = this._createSizerAndDistributor(resizeHandle);
        distributor.start();

        const onMouseMove = (event) => {
            const offset = sizer.offsetFromEvent(event);
            distributor.resizeFromContainerOffset(offset);
        };

        const body = document.body;
        const finishResize = () => {
            if (this.classNames.resizing) {
                this.container.classList.remove(this.classNames.resizing);
            }
            distributor.finish();
            body.removeEventListener("mouseup", finishResize, false);
            document.removeEventListener("mouseleave", finishResize, false);
            body.removeEventListener("mousemove", onMouseMove, false);
        };
        body.addEventListener("mouseup", finishResize, false);
        document.addEventListener("mouseleave", finishResize, false);
        body.addEventListener("mousemove", onMouseMove, false);
    }

    _createSizerAndDistributor(resizeHandle) {
        const vertical = resizeHandle.classList.contains(this.classNames.vertical);
        const reverse = this.isReverseResizeHandle(resizeHandle);
        const Distributor = this.distributorCtor;
        const sizer = Distributor.createSizer(this.container, vertical, reverse);
        const item = Distributor.createItem(resizeHandle, this, sizer);
        const distributor = new Distributor(item, this.config);
        return {sizer, distributor};
    }

    _getResizeHandles() {
        return Array.from(this.container.children).filter(el => {
            return this.isResizeHandle(el);
        });
    }
}
