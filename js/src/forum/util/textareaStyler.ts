import { SCEditor } from "../../@types/sceditor";

export function makeWrapTextarea(textarea: HTMLTextAreaElement, editor: SCEditor, flags: {
    updating_select: boolean, [key: string]: any
}) {
    let version = 0;
    let updated = 0;
    editor.bind("selectionchanged", () => flags.updating_select || updated++);
    editor.bind("nodechanged", () => flags.updating_select || updated++);
    editor.bind("valuechanged", () => flags.updating_select || updated++);
    return new Proxy(textarea, {
        get(target, prop) {
            if (prop === 'focus') {
                if (editor.sourceMode())
                    return target.focus.bind(target);
                if (version !== updated) {
                    flags.updating_select = true;
                    editor.getRangeHelper().saveRange();
                    if (editor.getRangeHelper().selectedRange().collapsed)
                        editor.insert("WYSIWGY_FLAG_SELECTRANGESTART")
                    else
                        editor.insert("WYSIWGY_FLAG_SELECTRANGESTART", "WYSIWGY_FLAG_SELECTRANGEEND")
                    const text = editor.val();
                    (editor as any)._keys['ctrl+z']();
                    const startIndex = text.indexOf("WYSIWGY_FLAG_SELECTRANGESTART");
                    const endIndex = text.indexOf("WYSIWGY_FLAG_SELECTRANGEEND");
                    target.value = text.replace(/WYSIWGY_FLAG_SELECTRANGESTART/g, "").replace(/WYSIWGY_FLAG_SELECTRANGEEND/g, "");
                    if (startIndex !== -1 && endIndex !== -1) {
                        target.setSelectionRange(startIndex, endIndex - "WYSIWGY_FLAG_SELECTRANGESTART".length);
                    }
                    editor.getRangeHelper().restoreRange();
                    version = updated;
                    flags.updating_select = false;
                }
                return target.focus.bind(target);
            } else if (prop === "value") {
                return target.value;
            }
            const a = Reflect.get(target, prop);
            if (typeof a == "function") return a.bind(target);
            return a;
        },
        set(target, prop, value) {
            if (prop === 'value') {
                target.value = value;
                if (!editor.sourceMode()) {
                    editor.val(value, true);
                }
                // textarea undo history
                let event = new CompositionEvent('compositionend', {
                    bubbles: true,
                    cancelable: true,
                    data: value
                });
                target.dispatchEvent(event);
            }
            return Reflect.set(target, prop, value);
        }
    })
}