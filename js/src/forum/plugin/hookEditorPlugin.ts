import { extend } from "flarum/common/extend";
import { SCEditor } from "../../@types/sceditor";

export default function hookEditorPlugin(this: typeof hookEditorPlugin & { init: () => void, destroy: () => void }) {
    let instance: SCEditor & { _keys: Record<string, any> };
    let thisObj: typeof hookEditorPlugin & { init: () => void, destroy: () => void } = this;

    this.init = function () {
        instance = this as any as SCEditor & { _keys: Record<string, any> };
        instance._keys = {};
        extend(instance, "addShortcut", (a, b, c) => {
            instance._keys[b] = c;
        });
    }
    this.destroy = function () {

    }
}