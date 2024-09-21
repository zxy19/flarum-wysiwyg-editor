import 'sceditor/minified/sceditor.min.js';
import 'sceditor/minified/formats/bbcode';
import 'sceditor/minified/plugins/undo';

import getCaretCoordinates from 'textarea-caret';
import ItemList from 'flarum/common/utils/ItemList';
import styleSelectedText from 'flarum/common/utils/styleSelectedText';
import type EditorDriverInterface from 'flarum/common/utils/EditorDriverInterface';
import { type EditorDriverParams } from 'flarum/common/utils/EditorDriverInterface';

import getTemplates, { Template } from './getTemplates';
import { BindEvent, GlobalSCEditor, RangeHelper, SCEditor } from '../@types/sceditor';
import { makeWrapTextarea } from './util/textareaStyler';
import { format, html, presentNodeEditable } from './util/bbcodeFormatUtil';
import { handleShortcuts } from './util/shortcutHandleUtil';

const DEBUG = true;

const ORIGINAL_TAGS = ['b', 'i', 'u', 's', 'sub', 'sup', 'font', 'size', 'color', 'ul',
  'list', 'ol', 'li', '*', 'table', 'tr', 'th', 'td', 'emoticon', 'hr', 'img', 'url',
  'email', 'quote', 'code', 'left', 'center', 'right', 'justify', 'youtube', 'rtl', 'ltr'];

export default class BBcodeEditorDriver implements EditorDriverInterface {
  el: HTMLTextAreaElement;
  tempEl: HTMLTextAreaElement;
  _textarea: HTMLTextAreaElement;
  view: any = null;
  params: EditorDriverParams | null = null;
  instance: SCEditor | null = null;
  editor: GlobalSCEditor | null = null;
  rangeHelper: RangeHelper | null = null;
  extraBBcode: Template[] = [];
  flags: {
    updating_select: boolean
  } = {
      updating_select: false
    };
  s9ePreview: HTMLDivElement;

  constructor(dom: HTMLElement, params: EditorDriverParams) {
    this._textarea = this.tempEl = this.el = document.createElement('textarea');
    this.s9ePreview = document.createElement('div');
    this.build(dom, params);
    // 搞一个假的textarea
    this.el = this.tempEl = makeWrapTextarea(this.tempEl, this.instance!, this.flags);
  }

  build(dom: HTMLElement, params: EditorDriverParams) {
    this.tempEl.className = params.classNames.join(' ');
    this.tempEl.disabled = params.disabled;
    this.tempEl.placeholder = params.placeholder;
    this.tempEl.value = params.value;
    dom.append(this.tempEl);

    this.s9ePreview.className = 'Post-body s9e-preview bbcode-editor-preview';
    this.s9ePreview.style.display = 'none';
    dom.append(this.s9ePreview);
    this.extraBBcode = getTemplates();
    this.params = params;
    let sceditor = window.sceditor;
    ORIGINAL_TAGS.forEach(tag => sceditor.formats.bbcode.remove(tag))
    this.extraBBcode.forEach((template) => {
      let name = template.name.toLowerCase();
      console.log("☘️Adding Template", name, template);
      sceditor.formats.bbcode.set(name, {
        tags: {
          [template.parentName]: {
            "data-template-match-name": template.name.toLowerCase(),
          },
        },
        allowsEmpty: true,
        isInline: template.inline,
        isSelfClosing: template.selfClose,
        format: format(template),
        html: html(template, this.s9ePreview)
      });
    });
    sceditor.create(this.tempEl, {
      format: 'bbcode',
      style: '/assets/extensions/foskym-wysiwyg-editor/content.min.css',
      toolbar: '',
      locale: 'cn',
      emoticonsEnabled: false,
      startInSourceMode: false,
      resizeEnabled: false,
      dateFormat: 'yyyy-mm-dd',
      rtl: false,
      plugins: "hooks,undo"
    });
    this.editor = sceditor;
    this.instance = sceditor.instance(this.tempEl);
    this.instance.bind("valuechanged", presentNodeEditable(this.instance) as any);
    handleShortcuts(this.instance);
    this.rangeHelper = this.instance.getRangeHelper();

    const cssClasses = params.classNames || [];
    cssClasses.forEach((className: string) => this.instance?.css(className));

    this.instance.width('100%');
    const root = document.documentElement;
    const bodyBg = getComputedStyle(root).getPropertyValue('--body-bg').trim();
    const controlColor = getComputedStyle(root).getPropertyValue('--text-color').trim();
    this.instance.css('body {background-color: ' + bodyBg + '; color: ' + controlColor + ' !important;}');
    this.instance.focus();

    let iframe = this.instance.getContentAreaContainer() as HTMLIFrameElement;
    this.tempEl = $(iframe.parentElement!).find("textarea")[0];

    const callInputListeners = (e: Event) => {
      this.params?.inputListeners.forEach((listener: any) => {
        listener.call(iframe);
      });

      e.redraw = false;
    };

    this.el.oninput = callInputListeners;
    this.el.onclick = callInputListeners;
    this.el.onkeyup = callInputListeners;

    (['keyup', 'keydown', 'keypress', 'blur', 'focus'] as BindEvent[]).forEach((event: BindEvent) => {
      this.instance!.bind(event, (e: Event) => {
        if (this.flags.updating_select) return;
        params.oninput(this.instance!.val());
        callInputListeners(e);
      });
    });

    let iframeDoc = iframe.contentDocument!;
    let iframeBody = iframeDoc.body;
    iframeBody.classList.add('bbcode-editor-content');
    iframeBody.classList.add('Post-body');

    let head = iframeDoc.head;
    let links = document.head.querySelectorAll('link');
    links.forEach((link) => {
      if (link.href.indexOf('forum') > -1) {
        head.appendChild(link.cloneNode(true));
      }
    });
  }

  getInstance() {
    return this.instance;
  }

  // External Control Stuff

  /**
   * Focus the textarea and place the cursor at the given index.
   *
   * @param {number} position
   */
  moveCursorTo(position: number) {
    this.setSelectionRange(position, position);
  }

  /**
   * Get the selected range of the textarea.
   *
   * @return {Array}
   */
  getSelectionRange() {
    this.el.focus();
    return [this.el.selectionStart, this.el.selectionEnd];
  }

  /**
   * Get (at most) the last N characters from the current "text block".
   */
  getLastNChars(n: number) {
    const range = this.getSelectionRange();
    const value = this.el.value;
    return value.slice(Math.max(0, range[0] - n), range[0]);
  }

  /**
   * Insert content into the textarea at the position of the cursor.
   *
   * @param {String} text
   */
  insertAtCursor(text: string) {
    const range = this.getSelectionRange();
    this.insertAt(range[0], text);
  }

  /**
   * Insert content into the textarea at the given position.
   *
   * @param {number} pos
   * @param {String} text
   */
  insertAt(pos: number, text: string) {
    this.insertBetween(pos, pos, text);
  }

  /**
   * Insert content into the textarea between the given positions.
   *
   * If the start and end positions are different, any text between them will be
   * overwritten.
   *
   * @param start
   * @param end
   * @param text
   */
  insertBetween(selectionStart: number, selectionEnd: number, text: string) {
    this.el.focus();
    this.el.value = this.el.value.substring(0, selectionStart) + text + this.el.value.substring(selectionEnd);
  }

  /**
   * Replace existing content from the start to the current cursor position.
   *
   * @param start
   * @param text
   */
  replaceBeforeCursor(start: number, text: string) {
    this.insertBetween(start, this.getSelectionRange()[0], text);
  }

  /**
   * Set the selected range of the textarea.
   *
   * @param {number} start
   * @param {number} end
   * @private
   */
  setSelectionRange(start: number, end: number) {
    this.el.selectionStart = start;
    this.el.selectionEnd = end;
  }

  getCaretCoordinates(position: number) {
    const isSourceMode = this.instance!.sourceMode();
    if (isSourceMode) {
      const relCoords = getCaretCoordinates(this.el, position);

      return {
        top: relCoords.top - this.el.scrollTop,
        left: relCoords.left,
      };
    }

    this.rangeHelper?.insertMarkers();
    const marker = $(this.instance!.getBody()).find("#sceditor-end-marker")[0];
    marker.style.display = "inline";
    const rect = marker.getBoundingClientRect();
    marker.style.display = "none";
    this.rangeHelper?.removeMarkers();
    const ret = {
      left: rect.left,
      top: rect.top,
    };
    DEBUG && console.log("🏁Rect Calc", ret);
    return ret;
  }

  focus() {
    this.instance!.focus();
  }

  destroy() {
    this.instance!.destroy();
  }

  disabled(disabled: boolean) {
    this.instance!.readOnly(disabled);
  }
}