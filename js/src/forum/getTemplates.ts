import XSLTMatchUtil from "../common/helper/XLSTMatchUtil";
import { transformTemplate } from "./util/templateReplaceUtil";

export type Template = {
  name: string,
  parentName: string,
  content: string,
  selfClose: boolean,
  inline: boolean,
  matching: XSLTMatchUtil
}

const specialTags = ["TABLE", "THEAD", "TH", "TR", "TD", "TBODY"];

function withGeneratedBBCode<T>(tagName: string, callback: (startTag: string, closeTag: string) => T): T | false {
  if (specialTags.includes(tagName.toUpperCase())) return false;
  //@ts-ignore
  const tagDef: any = s9e.TextFormatter.tagsConfig[tagName.toUpperCase()];
  if (!tagDef) return false;

  const attributeStrBuilder = [tagName];
  const filterChain = tagDef.filterChain;
  tagDef.filterChain = [];
  Object.keys(tagDef.attributes).map(e => e.toLowerCase())
    .forEach(attr => {
      if (attributeStrBuilder[0].toLowerCase() === tagName.toLowerCase()) {
        attributeStrBuilder[0] = `${attributeStrBuilder[0]}=0`;
      } else {
        attributeStrBuilder.push(`${attr}=0`);
      }
    });
  const attributeStr = attributeStrBuilder.join(" ");
  const startTag = `[${attributeStr}]`;
  const closeTag = `[/${tagName}]`;
  const ret = callback(startTag, closeTag);
  tagDef.filterChain = filterChain;
  return ret;
}

function closeTest(tagName: string) {
  return withGeneratedBBCode(tagName, (startTag, closeTag) => {
    const tmpNode = document.createElement("div");
    //@ts-ignore
    s9e.TextFormatter.preview(startTag + closeTag, tmpNode);
    if (tmpNode.innerHTML.includes(closeTag))
      return true;
    return false;
  })
}

function isBB(tagName: string) {
  return withGeneratedBBCode(tagName, (startTag, closeTag) => {
    //@ts-ignore
    const parseResult: string = s9e.TextFormatter.parse(startTag + closeTag);
    return parseResult.includes(`<${tagName.toUpperCase()}`);
  })
}

function isInline(tagName: string) {
  return withGeneratedBBCode(tagName, (startTag, closeTag) => {
    let preview = $(".s9e-preview.bbcode-editor-preview");
    if (!preview) {
      preview = $("<div></div>").appendTo($("body"));
    }
    //@ts-ignore
    s9e.TextFormatter.preview(startTag + closeTag, preview[0]);

    return ["inline", "inline-block"].includes((preview.children().first()[0]).computedStyleMap().get("display")?.toString() || "block");
  })
}

export default function getTemplates(): Template[] {
  // @ts-ignore
  let xsl = (new DOMParser).parseFromString(s9e.TextFormatter.xsl, 'text/xml');
  let templates: Template[] = [];
  // xsl:stylesheet > xsl:template
  let root = xsl.documentElement;
  (Array.from(root.getElementsByTagName("xsl:template")) as HTMLElement[]).forEach((template) => {
    let match = template.getAttribute('match');
    if (match === null || match.indexOf('|') > -1) return;
    if (!isBB(match)) return;
    let content = template.innerHTML;


    // parentName 为 template 的根节点名
    let parentName = template.firstElementChild?.tagName || "";
    if (!parentName) return;



    templates.push({
      name: match,
      parentName,
      content,
      inline: isInline(match),
      selfClose: closeTest(match),
      matching: new XSLTMatchUtil(template)
    });
  });
  return templates;
}