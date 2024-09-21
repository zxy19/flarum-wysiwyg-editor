import { SCEditor } from "../../@types/sceditor";
import { Template } from "../getTemplates";

const DEBUG = true;

export function format(template: Template) {
    return (elm: HTMLElement, content: string) => {
        console.log("✨H->B", elm, content);
        if (elm.getAttribute('data-template-match-name') === template.name.toLowerCase()) {
            const attributes = template.matching.matchAttributes(elm);
            if (attributes === false) {
                DEBUG && console.log("❌Template does not match", template.name);
                return content;
            }
            let name = template.name.toUpperCase();
            const selfTagAttr = Object.keys(attributes).find(k => k.toLowerCase() === template.name.toLowerCase());
            if (selfTagAttr) {
                name = `${name}=${attributes[selfTagAttr]}`;
                delete attributes[selfTagAttr];
            }

            const attributeStr = Object.keys(attributes)
                .filter(k => k != "@template" && k != "@pattern")
                .map((key: string) => `${key}=${attributes[key]}`)
                .join(' ');

            const closingTag = template.selfClose ? '' : `[/${template.name.toUpperCase()}]`;

            content = (new RegExp(attributes['@pattern'], 'img').exec(content) || ["", content])[1] || "";
            attributes['@template'] = content;

            const ret = `[${[name, attributeStr].filter(e => !!e).join(" ")}]${attributes['@template'] || ""}${closingTag}`;
            DEBUG && console.log("✅Match", attributes, ret);
            return ret;
        }
        DEBUG && console.log("❓Missing tag", content);
        return content;
    }
}
export function html(template: Template, preViewElem: HTMLElement) {
    return (token: any, attrs: any, content: string) => {
        console.log("🎈B->H", token, content);
        let val = token.val + "FLAT_WYSIWYG_CONTENT_PLACEHOLDER";
        if (token.closing?.val) {
            val += token.closing.val;
        }
        // @ts-ignore
        s9e.TextFormatter.preview(val, preViewElem);
        let html = $(preViewElem).html();
        $(preViewElem).html("");
        if (html.startsWith("<p>") && html.endsWith("</p>")) {
            html = html.substring(3, html.length - 4);
        }

        html = html.replace(/<([A-Za-z][^>]*)>/ig, "<$1 data-contenteditable=\"false\">");
        Array.from(html.matchAll(/<[A-Za-z]([^<>]*(data-contenteditable=\"false\"|data-editable=\"1\")[^<>]*){2}>/ig))
            .reverse()
            .forEach(e => {
                html = html.replace(e[0], e[0].replace("data-contenteditable=\"false\"", "data-contenteditable=\"true\""));
            });

        const ret = html.replace(/FLAT_WYSIWYG_CONTENT_PLACEHOLDER/g, content);
        DEBUG && console.log("✅Done", ret);
        return ret;
    }
}

export function presentNodeEditable(instance: SCEditor) {
    return (a: any) => {
        $(instance.getBody()).find("[data-contenteditable]").each((_,e) => {
            $(e).attr("contenteditable", $(e).attr("data-contenteditable")||"true").removeAttr("data-contenteditable");
        });
    }
}